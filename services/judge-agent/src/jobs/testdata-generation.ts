import { mkdtemp, rm, unlink, writeFile } from "fs/promises"
import path from "path"
import { tmpdir } from "os"
import { z } from "zod"
import type { GenerationLogLevel, Prisma, TestdataGenerationTaskStage } from "@prisma/client"
import { db } from "../db.js"
import { createStoredFileAsset } from "../lib/file-assets.js"
import { loadCode, readTextUri } from "../lib/process.js"
import {
  compileStandardSolution,
  executeStandardSolution,
  getTestdataRunnerMode,
  prepareRunnerWorkdir,
} from "../lib/testdata-runner.js"
import { createTestdataTaskPackageAsset } from "../lib/testdata-package.js"

const TestdataJobSchema = z.object({
  type: z.literal("testdata_generation"),
  taskId: z.string(),
  problemId: z.string(),
  problemVersionId: z.string(),
  standardSolutionId: z.string(),
  mode: z.enum(["APPEND", "REPLACE_GENERATED", "REPLACE_ALL"]),
  seed: z.string().optional(),
  queueName: z.string().optional(),
  plannedCaseCount: z.number().int().nonnegative().optional(),
  language: z.string(),
  codeUri: z.string(),
  config: z.unknown(),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
})

function sourceExtension(language: string) {
  if (language === "python") return "py"
  return "cpp"
}

type RunnerLanguage = "cpp11" | "cpp14" | "cpp17" | "python"

async function nextLogSequence(taskId: string) {
  return (await db.testdataGenerationLog.count({ where: { taskId } })) + 1
}

async function appendLog(input: {
  taskId: string
  stage: TestdataGenerationTaskStage
  level: GenerationLogLevel
  code?: string
  message: string
  detail?: Prisma.InputJsonValue
  workerId?: string
}) {
  await db.testdataGenerationLog.create({
    data: {
      taskId: input.taskId,
      sequenceNo: await nextLogSequence(input.taskId),
      level: input.level,
      stage: input.stage,
      code: input.code,
      message: input.message,
      detail: input.detail,
      workerId: input.workerId,
    },
  })
}

async function markTaskFailed(input: {
  taskId: string
  stage: TestdataGenerationTaskStage
  errorCode: string
  errorMessage: string
  workerId: string
}) {
  await db.testdataGenerationTask.update({
    where: { id: input.taskId },
    data: {
      status: "FAILED",
      stage: input.stage,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      workerId: input.workerId,
      finishedAt: new Date(),
    },
  })

  await appendLog({
    taskId: input.taskId,
    stage: input.stage,
    level: "ERROR",
    code: input.errorCode,
    message: input.errorMessage,
    workerId: input.workerId,
  })
}

function toFilePath(uri: string) {
  if (!uri.startsWith("file://")) {
    return null
  }
  try {
    return decodeURIComponent(new URL(uri).pathname)
  } catch {
    return uri.replace("file://", "")
  }
}

async function cleanupPackageAsset(asset: { id: string; uri: string }) {
  await db.fileAsset.delete({ where: { id: asset.id } }).catch(() => undefined)
  const filepath = toFilePath(asset.uri)
  if (filepath) {
    await unlink(filepath).catch(() => undefined)
  }
}

export async function handleTestdataGenerationJob(payload: unknown, workerId: string) {
  const job = TestdataJobSchema.parse(payload)
  const claimed = await db.testdataGenerationTask.updateMany({
    where: {
      id: job.taskId,
      status: "PENDING",
    },
    data: {
      status: "RUNNING",
      stage: "PREPARE_WORKDIR",
      workerId,
      startedAt: new Date(),
    },
  })

  if (claimed.count === 0) {
    return
  }

  const task = await db.testdataGenerationTask.findUnique({
    where: { id: job.taskId },
    include: {
      problem: {
        select: { id: true, slug: true, title: true },
      },
      problemVersion: {
        select: { id: true, version: true },
      },
      standardSolution: {
        select: { id: true, label: true, language: true },
      },
      requestedBy: {
        select: { id: true },
      },
      cases: {
        orderBy: { ordinal: "asc" },
        include: {
          inputAsset: {
            select: { id: true, uri: true, fileName: true },
          },
        },
      },
    },
  })

  if (!task) {
    return
  }

  await appendLog({
    taskId: task.id,
    stage: "PREPARE_WORKDIR",
    level: "INFO",
    code: "task_started",
    message: `Worker ${workerId} picked task ${task.id}`,
    workerId,
  })

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-testgen-"))
  const sourcePath = path.join(workDir, `main.${sourceExtension(job.language)}`)
  const binPath = path.join(workDir, "main.out")

  try {
    await prepareRunnerWorkdir(workDir)

    const code = await loadCode(undefined, job.codeUri)
    await writeFile(sourcePath, code, "utf8")

    const isCpp = job.language === "cpp11" || job.language === "cpp14" || job.language === "cpp17"
    const isPython = job.language === "python"
    if (!isCpp && !isPython) {
      throw new Error("unsupported_language")
    }
    const runnerLanguage = job.language as RunnerLanguage

    await db.testdataGenerationTask.update({
      where: { id: task.id },
      data: { stage: "COMPILE_SOLUTION" },
    })
    await appendLog({
      taskId: task.id,
      stage: "COMPILE_SOLUTION",
      level: "INFO",
      code: "runner_selected",
      message: `Using ${getTestdataRunnerMode()} runner for standard solution execution`,
      workerId,
    })

    let compileDurationMs = 0
    let compileStdoutAssetId: string | undefined
    let compileStderrAssetId: string | undefined

    const compileStart = Date.now()
    const compile = await compileStandardSolution({
      language: runnerLanguage,
      workDir,
      sourcePath,
      binPath,
      timeoutMs: 10000,
    })
    compileDurationMs = Date.now() - compileStart

    if (compile.stdout.trim()) {
      const asset = await createStoredFileAsset({
        prefix: "testgen-compile",
        fileName: `${task.id}-compile-stdout.txt`,
        content: compile.stdout,
        kind: "COMPILE_STDOUT",
        mimeType: "text/plain",
        createdById: task.requestedBy.id,
      })
      compileStdoutAssetId = asset.id
    }
    if (compile.stderr.trim()) {
      const asset = await createStoredFileAsset({
        prefix: "testgen-compile",
        fileName: `${task.id}-compile-stderr.txt`,
        content: compile.stderr,
        kind: "COMPILE_STDERR",
        mimeType: "text/plain",
        createdById: task.requestedBy.id,
      })
      compileStderrAssetId = asset.id
    }

    await db.testdataGenerationTask.update({
      where: { id: task.id },
      data: {
        compileExitCode: compile.code,
        compileDurationMs,
        compileStdoutAssetId,
        compileStderrAssetId,
      },
    })

    if (compile.timedOut || compile.killed || compile.code !== 0) {
      await markTaskFailed({
        taskId: task.id,
        stage: "COMPILE_SOLUTION",
        errorCode: "compile_failed",
        errorMessage: compile.timedOut ? "standard solution compile timed out" : "standard solution compile failed",
        workerId,
      })
      return
    }

    await db.testdataGenerationTask.update({
      where: { id: task.id },
      data: { stage: "RUN_SOLUTION" },
    })
    await appendLog({
      taskId: task.id,
      stage: "RUN_SOLUTION",
      level: "INFO",
      code: "run_started",
      message: `Running standard solution on ${task.cases.length} generated cases`,
      workerId,
    })

    for (const testcase of task.cases) {
      if (!testcase.inputAsset) {
        throw new Error(`missing_input_asset:${testcase.id}`)
      }

      await db.testdataCase.update({
        where: { id: testcase.id },
        data: {
          status: "RUNNING",
          executionStatus: "NOT_STARTED",
        },
      })

      const input = await readTextUri(testcase.inputAsset.uri)
      const startedAt = Date.now()
      const result = await executeStandardSolution({
        language: runnerLanguage,
        workDir,
        sourcePath,
        binPath,
        input,
        timeoutMs: Math.max(job.timeLimitMs, 1000),
      })
      const durationMs = Date.now() - startedAt

      if (result.timedOut || result.killed || result.code !== 0) {
        let runtimeStderrAssetId: string | undefined
        if (result.stderr.trim()) {
          const stderrAsset = await createStoredFileAsset({
            prefix: "testgen-runtime",
            fileName: `${task.id}-${String(testcase.ordinal).padStart(3, "0")}.stderr.txt`,
            content: result.stderr,
            kind: "RUNTIME_STDERR",
            mimeType: "text/plain",
            createdById: task.requestedBy.id,
          })
          runtimeStderrAssetId = stderrAsset.id
        }

        await db.testdataCase.update({
          where: { id: testcase.id },
          data: {
            status: "FAILED",
            executionStatus: result.timedOut ? "TIME_LIMIT_EXCEEDED" : "RUNTIME_ERROR",
            executionDurationMs: durationMs,
            executionMemoryKb: 0,
            exitCode: result.code,
            runtimeStderrAssetId,
            errorCode: result.timedOut ? "time_limit_exceeded" : "runtime_error",
            errorMessage: result.timedOut
              ? `case #${testcase.ordinal} exceeded time limit`
              : result.signal
                ? `case #${testcase.ordinal} exited with signal ${result.signal}`
                : `case #${testcase.ordinal} exited with code ${result.code}`,
          },
        })

        await markTaskFailed({
          taskId: task.id,
          stage: "RUN_SOLUTION",
          errorCode: result.timedOut ? "time_limit_exceeded" : "runtime_error",
          errorMessage: `standard solution failed on case #${testcase.ordinal}`,
          workerId,
        })
        return
      }

      const outputAsset = await createStoredFileAsset({
        prefix: "generated-outputs",
        fileName: `${testcase.groupKey ?? "case"}-${String(testcase.ordinal).padStart(3, "0")}.out`,
        content: result.stdout,
        kind: "TESTCASE_EXPECTED_OUTPUT",
        mimeType: "text/plain",
        createdById: task.requestedBy.id,
        metadata: {
          taskId: task.id,
          ordinal: testcase.ordinal,
        } satisfies Prisma.InputJsonValue,
      })

      let runtimeStderrAssetId: string | undefined
      if (result.stderr.trim()) {
        const stderrAsset = await createStoredFileAsset({
          prefix: "testgen-runtime",
          fileName: `${task.id}-${String(testcase.ordinal).padStart(3, "0")}.stderr.txt`,
          content: result.stderr,
          kind: "RUNTIME_STDERR",
          mimeType: "text/plain",
          createdById: task.requestedBy.id,
        })
        runtimeStderrAssetId = stderrAsset.id
      }

      await db.testdataCase.update({
        where: { id: testcase.id },
        data: {
          status: "OUTPUT_READY",
          executionStatus: "SUCCESS",
          executionDurationMs: durationMs,
          executionMemoryKb: 0,
          exitCode: result.code,
          expectedOutputAssetId: outputAsset.id,
          runtimeStderrAssetId,
        },
      })
    }

    await db.testdataGenerationTask.update({
      where: { id: task.id },
      data: { stage: "PERSIST_CASES" },
    })

    const refreshedCases = await db.testdataCase.findMany({
      where: { taskId: task.id },
      orderBy: { ordinal: "asc" },
      include: {
        inputAsset: {
          select: { id: true, uri: true },
        },
        expectedOutputAsset: {
          select: { id: true, uri: true },
        },
      },
    })

    const publishResult = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      let replacedTestcaseCount = 0
      if (job.mode === "REPLACE_ALL") {
        const deleted = await tx.testcase.deleteMany({
          where: { versionId: task.problemVersionId },
        })
        replacedTestcaseCount = deleted.count
      } else if (job.mode === "REPLACE_GENERATED") {
        const deleted = await tx.testcase.deleteMany({
          where: {
            versionId: task.problemVersionId,
            sourceType: "AUTO_GENERATED",
          },
        })
        replacedTestcaseCount = deleted.count
      }

      await tx.testcase.createMany({
        data: refreshedCases.map((item: (typeof refreshedCases)[number]) => {
          if (!item.inputAsset?.uri || !item.expectedOutputAsset?.uri) {
            throw new Error(`case_assets_missing:${item.id}`)
          }

          return {
            versionId: task.problemVersionId,
            title: item.title,
            caseType: item.caseType,
            visible: item.visible,
            inputUri: item.inputAsset.uri,
            outputUri: item.expectedOutputAsset.uri,
            score: item.score,
            subtaskId: item.subtaskId,
            isPretest: item.isPretest,
            groupId: item.groupId,
            isSample: item.isSample,
            sourceType: "AUTO_GENERATED",
            generationTaskId: task.id,
            generationOrdinal: item.ordinal,
            orderIndex: item.orderIndex,
          }
        }),
      })

      await tx.testdataCase.updateMany({
        where: {
          taskId: task.id,
          status: "OUTPUT_READY",
        },
        data: { status: "PERSISTED" },
      })

      await tx.testdataGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "SUCCEEDED",
          stage: "FINALIZE",
          succeededCaseCount: refreshedCases.length,
          failedCaseCount: 0,
          persistedCaseCount: refreshedCases.length,
          replacedTestcaseCount,
          finishedAt: new Date(),
          resultSummary: {
            publishedCaseCount: refreshedCases.length,
            mode: job.mode,
          } satisfies Prisma.InputJsonValue,
        },
      })

      return { replacedTestcaseCount }
    })

    let packageAsset: { id: string; uri: string; fileName: string } | undefined
    try {
      packageAsset = await createTestdataTaskPackageAsset({
        task: {
          taskId: task.id,
          problemId: task.problemId,
          problemSlug: task.problem.slug,
          problemTitle: task.problem.title,
          problemVersionId: task.problemVersionId,
          version: task.problemVersion.version,
          mode: task.mode,
          seed: task.seed,
          standardSolution: {
            id: task.standardSolution.id,
            label: task.standardSolution.label,
            language: task.standardSolution.language,
          },
          requestedById: task.requestedBy.id,
          plannedCaseCount: task.plannedCaseCount,
          persistedCaseCount: refreshedCases.length,
          createdAt: task.createdAt,
          finishedAt: new Date(),
        },
        cases: refreshedCases.map((item: (typeof refreshedCases)[number]) => {
          if (!item.inputAsset?.uri || !item.expectedOutputAsset?.uri) {
            throw new Error(`case_assets_missing:${item.id}`)
          }
          return {
            ordinal: item.ordinal,
            title: item.title,
            groupKey: item.groupKey,
            score: item.score,
            isSample: item.isSample,
            isPretest: item.isPretest,
            visible: item.visible,
            caseType: item.caseType,
            subtaskId: item.subtaskId,
            groupId: item.groupId,
            orderIndex: item.orderIndex,
            inputAssetUri: item.inputAsset.uri,
            expectedOutputAssetUri: item.expectedOutputAsset.uri,
          }
        }),
      })

      await db.testdataGenerationTask.update({
        where: { id: task.id },
        data: {
          packageAssetId: packageAsset.id,
          resultSummary: {
            publishedCaseCount: refreshedCases.length,
            mode: job.mode,
            packageAssetId: packageAsset.id,
            packageGeneratedAt: new Date().toISOString(),
          } satisfies Prisma.InputJsonValue,
        },
      })

      await appendLog({
        taskId: task.id,
        stage: "FINALIZE",
        level: "INFO",
        code: "package_generated",
        message: `Pre-generated testcase package ${packageAsset.fileName}`,
        detail: {
          packageAssetId: packageAsset.id,
        } satisfies Prisma.InputJsonValue,
        workerId,
      })
    } catch (error) {
      if (packageAsset) {
        await cleanupPackageAsset(packageAsset)
      }
      await appendLog({
        taskId: task.id,
        stage: "FINALIZE",
        level: "WARN",
        code: "package_generation_failed",
        message: error instanceof Error ? error.message : String(error),
        workerId,
      })
    }

    await appendLog({
      taskId: task.id,
      stage: "FINALIZE",
      level: "INFO",
      code: "task_succeeded",
      message: `Published ${refreshedCases.length} generated testcases`,
      detail: {
        replacedTestcaseCount: publishResult.replacedTestcaseCount,
      } satisfies Prisma.InputJsonValue,
      workerId,
    })
  } catch (error) {
    await markTaskFailed({
      taskId: task.id,
      stage: "FINALIZE",
      errorCode: "system_error",
      errorMessage: error instanceof Error ? error.message : String(error),
      workerId,
    })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
