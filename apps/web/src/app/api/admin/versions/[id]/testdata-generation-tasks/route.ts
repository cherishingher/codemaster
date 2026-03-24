import { NextResponse, type NextRequest } from "next/server"
import { Prisma, type TestdataGenerationTaskStatus } from "@prisma/client"
import { z } from "zod"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { createStoredFileAsset } from "@/lib/file-assets"
import { readStoredTextAssetByUri } from "@/lib/file-assets"
import { problemModeSupportsCode, resolveProblemAdminMode } from "@/lib/problem-admin"
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

const execFileAsync = promisify(execFile)

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

function resolveTestdataExecutionMode() {
  const raw = process.env.TESTDATA_GENERATION_EXECUTION_MODE?.trim().toLowerCase()
  if (raw === "queue") return "queue"
  return "inline"
}

function resolveInlineRunnerScriptPath() {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/scripts/run-testdata-generation-task.mts"),
    path.resolve(process.cwd(), "scripts/run-testdata-generation-task.mts"),
  ]
  const matched = candidates.find((candidate) => fs.existsSync(candidate))
  if (!matched) {
    throw new Error("inline_runner_script_not_found")
  }
  return matched
}

function resolveTsxBinaryPath() {
  const candidates = [
    path.resolve(process.cwd(), "node_modules/.bin/tsx"),
    path.resolve(process.cwd(), "../node_modules/.bin/tsx"),
    path.resolve(process.cwd(), "../../node_modules/.bin/tsx"),
  ]
  const matched = candidates.find((candidate) => fs.existsSync(candidate))
  if (!matched) {
    throw new Error("tsx_binary_not_found")
  }
  return matched
}

function resolveWebTsconfigPath() {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/tsconfig.json"),
    path.resolve(process.cwd(), "tsconfig.json"),
    path.resolve(process.cwd(), "../apps/web/tsconfig.json"),
  ]
  const matched = candidates.find((candidate) => fs.existsSync(candidate))
  if (!matched) {
    throw new Error("web_tsconfig_not_found")
  }
  return matched
}

async function runTaskInline(taskId: string) {
  const scriptPath = resolveInlineRunnerScriptPath()
  const tsxBinary = resolveTsxBinaryPath()
  const tsconfigPath = resolveWebTsconfigPath()
  const runnerEnv = {
    ...process.env,
    TESTDATA_RUNNER_MODE: process.env.TESTDATA_RUNNER_MODE ?? "docker",
  }
  const { stdout, stderr } = await execFileAsync(
    tsxBinary,
    ["--tsconfig", tsconfigPath, scriptPath, "--taskId", taskId, "--workerId", `inline-${process.pid}`],
    {
      cwd: process.cwd(),
      env: runnerEnv,
      maxBuffer: 4 * 1024 * 1024,
    }
  ).catch((error: Error & { stdout?: string; stderr?: string }) => {
    throw new Error(
      [
        "inline_generation_failed",
        error.message,
        error.stderr?.trim(),
        error.stdout?.trim(),
      ]
        .filter(Boolean)
        .join(": ")
    )
  })

  return { stdout, stderr }
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
  const problemMode = resolveProblemAdminMode({
    tags: version.problem.tags.map((item) => item.tag.name),
  })
  if (!problemModeSupportsCode(problemMode)) {
    return NextResponse.json(
      { error: "scratch_problem_not_supported", message: "Scratch 题不使用标准输入输出测试点生成任务。" },
      { status: 422 }
    )
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

  const standardSolutionSource = await readStoredTextAssetByUri(standardSolution.sourceAsset?.uri).catch(() => null)

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
      solutionSource: standardSolutionSource,
      solutionLanguage: standardSolution.language,
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

  let inlineExecutionError: string | null = null

  if (resolveTestdataExecutionMode() === "queue") {
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
  } else {
    try {
      await runTaskInline(created.id)
    } catch (error) {
      inlineExecutionError = error instanceof Error ? error.message : String(error)
    }
  }

  const refreshed = await db.testdataGenerationTask.findUnique({
    where: { id: created.id },
    select: {
      id: true,
      problemVersionId: true,
      standardSolutionId: true,
      status: true,
      stage: true,
      mode: true,
      seed: true,
      plannedCaseCount: true,
      generatedCaseCount: true,
      persistedCaseCount: true,
      createdAt: true,
      errorCode: true,
      errorMessage: true,
    },
  })

  if (!refreshed) {
    return NextResponse.json({ error: "task_not_found_after_create" }, { status: 500 })
  }

  if (inlineExecutionError && refreshed.status === "PENDING") {
    return NextResponse.json(
      {
        error: "inline_generation_failed",
        message: "测试点生成未能直接执行，请检查本地生成环境。",
        detail: inlineExecutionError,
        task: refreshed,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    task: {
      id: refreshed.id,
      problemVersionId: refreshed.problemVersionId,
      standardSolutionId: refreshed.standardSolutionId,
      status: refreshed.status,
      stage: refreshed.stage,
      mode: refreshed.mode,
      seed: refreshed.seed,
      plannedCaseCount: refreshed.plannedCaseCount,
      generatedCaseCount: refreshed.generatedCaseCount,
      persistedCaseCount: refreshed.persistedCaseCount,
      configSource,
      errorCode: refreshed.errorCode,
      errorMessage: refreshed.errorMessage,
      createdAt: refreshed.createdAt,
    },
    ...(inlineExecutionError ? { warning: inlineExecutionError } : {}),
  }, { status: 201 })
}, { roles: "admin" })

export const runtime = "nodejs"
