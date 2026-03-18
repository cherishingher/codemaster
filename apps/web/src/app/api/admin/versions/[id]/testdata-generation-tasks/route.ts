import { NextResponse, type NextRequest } from "next/server"
import { Prisma, type TestdataGenerationTaskStatus } from "@prisma/client"
import { z } from "zod"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { createStoredFileAsset } from "@/lib/file-assets"
import { analyzeProblemForTestdata } from "@/lib/problem-analysis"
import { pushTestdataGenerationJob } from "@/lib/queue"
import { generatePlannedCase, validateAndPlanTestdataConfig } from "@/lib/testdata-gen"
import {
  buildSolutionSnapshot,
  buildTestdataRequestFingerprint,
  resolveTaskSeed,
  summarizeTaskForQueue,
  TESTDATA_QUEUE_NAME,
  toInputJsonValue,
} from "@/lib/testdata-gen/task-utils"

const CreateTaskSchema = z.object({
  standardSolutionId: z.string().min(1),
  mode: z.enum(["APPEND", "REPLACE_GENERATED", "REPLACE_ALL"]).default("APPEND"),
  seed: z.string().min(1).optional(),
  testcaseCount: z.number().int().positive().max(200).optional(),
  totalScore: z.number().int().positive().max(10000).optional(),
})

function parsePagination(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20))
  return { page, pageSize }
}

export const GET = withAuth(async (req, { params }) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  const { page, pageSize } = parsePagination(req)
  const status = req.nextUrl.searchParams.get("status") || undefined
  const where: Prisma.TestdataGenerationTaskWhereInput = {
    problemVersionId: params.id,
    ...(status ? { status: status as TestdataGenerationTaskStatus } : {}),
  }

  const [items, total] = await Promise.all([
    db.testdataGenerationTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        standardSolution: {
          select: {
            id: true,
            label: true,
            language: true,
          },
        },
      },
    }),
    db.testdataGenerationTask.count({ where }),
  ])

  return NextResponse.json({
    items: items.map((task) => ({
      id: task.id,
      status: task.status,
      stage: task.stage,
      mode: task.mode,
      seed: task.seed,
      attemptNo: task.attemptNo,
      standardSolution: task.standardSolution,
      plannedCaseCount: task.plannedCaseCount,
      generatedCaseCount: task.generatedCaseCount,
      succeededCaseCount: task.succeededCaseCount,
      failedCaseCount: task.failedCaseCount,
      persistedCaseCount: task.persistedCaseCount,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
    })),
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
  })
}, { roles: "admin" })

export const POST = withAuth(async (req, { params }, user) => {
  const payload = CreateTaskSchema.parse(await req.json())
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      problemId: true,
      statement: true,
      statementMd: true,
      constraints: true,
      inputFormat: true,
      outputFormat: true,
      timeLimitMs: true,
      memoryLimitMb: true,
      testdataGenerationConfig: true,
      problem: {
        select: {
          title: true,
          tags: {
            include: { tag: true },
          },
        },
      },
    },
  })
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }
  const standardSolution = await db.standardSolution.findUnique({
    where: { id: payload.standardSolutionId },
    include: {
      sourceAsset: {
        select: {
          id: true,
          uri: true,
          fileName: true,
          byteSize: true,
          checksumSha256: true,
        },
      },
    },
  })
  if (!standardSolution || standardSolution.problemVersionId !== params.id) {
    return NextResponse.json({ error: "solution_not_found" }, { status: 404 })
  }

  let generationConfig: unknown = version.testdataGenerationConfig
  let configSource: "saved_config" | "auto_analysis" = "saved_config"

  if (payload.testcaseCount !== undefined) {
    if (payload.totalScore !== undefined && payload.totalScore % payload.testcaseCount !== 0) {
      return NextResponse.json({
        error: "equal_score_not_divisible",
        message: "总分无法被测试点个数整除，当前不满足平分得分。",
      }, { status: 422 })
    }

    const bundle = analyzeProblemForTestdata({
      problemId: version.problemId,
      versionId: version.id,
      title: version.problem.title,
      statement: version.statement,
      statementMd: version.statementMd,
      constraints: version.constraints,
      inputFormat: version.inputFormat,
      outputFormat: version.outputFormat,
      tags: version.problem.tags.map((item) => item.tag.name),
    }, {
      testcaseCount: payload.testcaseCount,
      totalScore: payload.totalScore,
    })

    if (!bundle.configDraft) {
      return NextResponse.json({
        error: "auto_generation_strategy_unavailable",
        message: bundle.analysis.warnings[0] ?? "当前题型暂不支持自动生成测试数据配置。",
        analysis: bundle.analysis,
      }, { status: 422 })
    }

    generationConfig = bundle.configDraft
    configSource = "auto_analysis"
  }

  if (!generationConfig) {
    return NextResponse.json({ error: "generation_config_missing" }, { status: 422 })
  }

  const seed = resolveTaskSeed(payload.seed)
  const { config, plans } = validateAndPlanTestdataConfig(generationConfig, seed)
  const plannedCaseCount = plans.length
  const configSnapshot = config as Prisma.JsonValue
  const solutionSnapshot = buildSolutionSnapshot(standardSolution, standardSolution.sourceAsset)
  const requestFingerprint = buildTestdataRequestFingerprint({
    versionId: params.id,
    standardSolutionId: standardSolution.id,
    mode: payload.mode,
    seed,
    configSnapshot,
  })

  const runningTask = await db.testdataGenerationTask.findFirst({
    where: {
      requestFingerprint,
      status: { in: ["PENDING", "RUNNING"] },
    },
    select: { id: true },
  })
  if (runningTask) {
    return NextResponse.json({ error: "task_already_running", taskId: runningTask.id }, { status: 409 })
  }

  const generatedInputs = await Promise.all(
    plans.map(async (plan) => {
      // MVP keeps generator execution in the web tier so the worker only compiles,
      // runs the standard solution, and publishes final testcases.
      const generated = generatePlannedCase(plan)
      const inputAsset = await createStoredFileAsset({
        prefix: "generated-inputs",
        fileName: `${plan.groupKey}-${String(plan.ordinal).padStart(3, "0")}.in`,
        content: generated.input,
        kind: "TESTCASE_INPUT",
        mimeType: "text/plain",
        createdById: user.id,
        metadata: toInputJsonValue({
          taskSeed: plan.caseSeed,
          generator: plan.generator.type,
          planOrdinal: plan.ordinal,
        }),
      })
      return { plan, generated, inputAsset }
    })
  )

  const created = await db.$transaction(async (tx) => {
    const task = await tx.testdataGenerationTask.create({
      data: {
        problemId: version.problemId,
        problemVersionId: version.id,
        standardSolutionId: standardSolution.id,
        requestedById: user.id,
        status: "PENDING",
        stage: "VALIDATE_CONFIG",
        mode: payload.mode,
        queueName: TESTDATA_QUEUE_NAME,
        seed,
        requestFingerprint,
        configSnapshot: configSnapshot as Prisma.InputJsonValue,
        solutionSnapshot: solutionSnapshot as Prisma.InputJsonValue,
        plannedCaseCount,
        generatedCaseCount: generatedInputs.length,
      },
    })

    await tx.testdataCase.createMany({
      data: generatedInputs.map(({ plan, generated, inputAsset }) => ({
        taskId: task.id,
        ordinal: plan.ordinal,
        groupKey: plan.groupKey,
        title: plan.groupTitle ?? `${plan.groupKey}-${String(plan.ordinal).padStart(3, "0")}`,
        score: plan.score,
        isSample: plan.isSample,
        isPretest: plan.isPretest,
        visible: plan.visible,
        caseType: plan.caseType,
        subtaskId: plan.subtaskId,
        groupId: plan.groupId,
        orderIndex: plan.orderIndex,
        caseSeed: plan.caseSeed,
        generatorInput: toInputJsonValue({
          generator: plan.generator.type,
          metadata: generated.metadata ?? {},
        }),
        inputAssetId: inputAsset.id,
        status: "INPUT_READY",
      })),
    })

    await tx.testdataGenerationLog.create({
      data: {
        taskId: task.id,
        sequenceNo: 1,
        level: "INFO",
        stage: "GENERATE_INPUTS",
        code: "inputs_prepared",
        message: `Prepared ${generatedInputs.length} generated inputs`,
        detail: {
          seed,
          configSource,
          groups: config.groups.map((group) => ({ key: group.key, count: group.count })),
        } satisfies Prisma.InputJsonValue,
      },
    })

    return task
  })

  await pushTestdataGenerationJob(
    summarizeTaskForQueue({
      task: created,
      language: standardSolution.language,
      codeUri: standardSolution.sourceAsset.uri,
      configSnapshot,
      timeLimitMs: version.timeLimitMs,
      memoryLimitMb: version.memoryLimitMb,
    })
  )

  return NextResponse.json({
    ok: true,
    task: {
      id: created.id,
      problemVersionId: created.problemVersionId,
      standardSolutionId: created.standardSolutionId,
      status: created.status,
      stage: created.stage,
      mode: created.mode,
      seed: created.seed,
      plannedCaseCount: created.plannedCaseCount,
      generatedCaseCount: created.generatedCaseCount,
      persistedCaseCount: created.persistedCaseCount,
      configSource,
      createdAt: created.createdAt,
    },
  }, { status: 201 })
}, { roles: "admin" })

export const runtime = "nodejs"
