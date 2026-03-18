import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { createStoredFileAsset } from "@/lib/file-assets"
import { pushTestdataGenerationJob } from "@/lib/queue"
import { generatePlannedCase, validateAndPlanTestdataConfig } from "@/lib/testdata-gen"
import {
  buildTestdataRequestFingerprint,
  resolveTaskSeed,
  summarizeTaskForQueue,
  TESTDATA_QUEUE_NAME,
  toInputJsonValue,
} from "@/lib/testdata-gen/task-utils"

export const POST = withAuth(async (_req, { params }, user) => {
  const sourceTask = await db.testdataGenerationTask.findUnique({
    where: { id: params.taskId },
    include: {
      standardSolution: {
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
      },
      problemVersion: {
        select: {
          id: true,
          problemId: true,
          timeLimitMs: true,
          memoryLimitMb: true,
        },
      },
    },
  })

  if (!sourceTask) {
    return NextResponse.json({ error: "task_not_found" }, { status: 404 })
  }
  if (sourceTask.status !== "FAILED" && sourceTask.status !== "CANCELLED") {
    return NextResponse.json({ error: "task_not_retryable" }, { status: 409 })
  }

  const seed = resolveTaskSeed(sourceTask.seed ? `${sourceTask.seed}-retry-${sourceTask.attemptNo + 1}` : undefined)
  const { config, plans } = validateAndPlanTestdataConfig(sourceTask.configSnapshot, seed)
  const configSnapshot = config as Prisma.JsonValue
  const configInputSnapshot = toInputJsonValue(config)
  const requestFingerprint = buildTestdataRequestFingerprint({
    versionId: sourceTask.problemVersionId,
    standardSolutionId: sourceTask.standardSolutionId,
    mode: sourceTask.mode,
    seed,
    configSnapshot,
  })

  const generatedInputs = await Promise.all(
    plans.map(async (plan) => {
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
        problemId: sourceTask.problemId,
        problemVersionId: sourceTask.problemVersionId,
        standardSolutionId: sourceTask.standardSolutionId,
        requestedById: user.id,
        status: "PENDING",
        stage: "VALIDATE_CONFIG",
        mode: sourceTask.mode,
        queueName: TESTDATA_QUEUE_NAME,
        seed,
        attemptNo: sourceTask.attemptNo + 1,
        retriedFromTaskId: sourceTask.id,
        requestFingerprint,
        configSnapshot: configInputSnapshot,
        solutionSnapshot: toInputJsonValue(sourceTask.solutionSnapshot),
        plannedCaseCount: plans.length,
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
          groups: config.groups.map((group) => ({ key: group.key, count: group.count })),
          retriedFromTaskId: sourceTask.id,
        },
      },
    })

    return task
  })

  await pushTestdataGenerationJob(
    summarizeTaskForQueue({
      task: created,
      language: sourceTask.standardSolution.language,
      codeUri: sourceTask.standardSolution.sourceAsset.uri,
      configSnapshot,
      timeLimitMs: sourceTask.problemVersion.timeLimitMs,
      memoryLimitMb: sourceTask.problemVersion.memoryLimitMb,
    })
  )

  return NextResponse.json({
    ok: true,
    task: {
      id: created.id,
      retriedFromTaskId: created.retriedFromTaskId,
      status: created.status,
      stage: created.stage,
      mode: created.mode,
      seed: created.seed,
      attemptNo: created.attemptNo,
      createdAt: created.createdAt,
    },
  }, { status: 201 })
}, { roles: "admin" })
