import * as dbModule from "../src/lib/db"
import * as taskUtilsModule from "../src/lib/testdata-gen/task-utils"

const dbExports = (dbModule as Record<string, unknown>).default as Record<string, unknown> | undefined
const taskUtilsExports = (taskUtilsModule as Record<string, unknown>).default as
  | Record<string, unknown>
  | undefined

const { db } = (dbExports ?? (dbModule as Record<string, unknown>)) as {
  db: typeof import("../src/lib/db").db
}

const { summarizeTaskForQueue } = (taskUtilsExports ?? (taskUtilsModule as Record<string, unknown>)) as {
  summarizeTaskForQueue: typeof import("../src/lib/testdata-gen/task-utils").summarizeTaskForQueue
}

function readArg(name: string) {
  const index = process.argv.findIndex((value) => value === name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const taskId = readArg("--taskId")
  const workerId = readArg("--workerId") ?? `inline-${Date.now()}`

  if (!taskId) {
    throw new Error("task_id_required")
  }

  const task = await db.testdataGenerationTask.findUnique({
    where: { id: taskId },
    include: {
      problemVersion: {
        select: {
          id: true,
          timeLimitMs: true,
          memoryLimitMb: true,
        },
      },
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
    },
  })

  if (!task) {
    throw new Error("task_not_found")
  }
  if (!task.standardSolution?.sourceAsset?.uri) {
    throw new Error("standard_solution_source_missing")
  }

  const { handleTestdataGenerationJob } = await import("../../../services/judge-agent/src/jobs/testdata-generation")

  await handleTestdataGenerationJob(
    summarizeTaskForQueue({
      task,
      language: task.standardSolution.language,
      codeUri: task.standardSolution.sourceAsset.uri,
      configSnapshot: task.configSnapshot,
      timeLimitMs: task.problemVersion.timeLimitMs,
      memoryLimitMb: task.problemVersion.memoryLimitMb,
    }),
    workerId
  )

  const refreshed = await db.testdataGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      stage: true,
      errorCode: true,
      errorMessage: true,
      persistedCaseCount: true,
      succeededCaseCount: true,
      failedCaseCount: true,
    },
  })

  if (!refreshed) {
    throw new Error("task_missing_after_run")
  }

  process.stdout.write(`${JSON.stringify(refreshed)}\n`)

  if (refreshed.status !== "SUCCEEDED") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
