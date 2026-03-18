import { createHash, randomUUID } from "crypto"
import { Prisma, type FileAsset, type StandardSolution, type TestdataGenerationTask } from "@prisma/client"
import { validateAndPlanTestdataConfig } from "@/lib/testdata-gen"

export const TESTDATA_QUEUE_NAME = "testgen:jobs"

type TaskCreateMode = "APPEND" | "REPLACE_GENERATED" | "REPLACE_ALL"

export function resolveTaskSeed(seed?: string | null) {
  return seed?.trim() || randomUUID()
}

export function buildTestdataRequestFingerprint(input: {
  versionId: string
  standardSolutionId: string
  mode: TaskCreateMode
  seed: string
  configSnapshot: Prisma.JsonValue
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        versionId: input.versionId,
        standardSolutionId: input.standardSolutionId,
        mode: input.mode,
        seed: input.seed,
        configSnapshot: input.configSnapshot,
      })
    )
    .digest("hex")
}

export function buildSolutionSnapshot(
  solution: Pick<StandardSolution, "id" | "label" | "language" | "sourceHash" | "runOptions" | "compileOptions">,
  asset: Pick<FileAsset, "id" | "uri" | "fileName" | "byteSize" | "checksumSha256">
) {
  return {
    id: solution.id,
    label: solution.label,
    language: solution.language,
    sourceHash: solution.sourceHash,
    compileOptions: solution.compileOptions,
    runOptions: solution.runOptions,
    sourceAsset: {
      id: asset.id,
      uri: asset.uri,
      fileName: asset.fileName,
      byteSize: asset.byteSize,
      checksumSha256: asset.checksumSha256,
    },
  }
}

export function summarizeTaskForQueue(input: {
  task: Pick<
    TestdataGenerationTask,
    | "id"
    | "problemId"
    | "problemVersionId"
    | "standardSolutionId"
    | "mode"
    | "seed"
    | "plannedCaseCount"
    | "queueName"
  >
  language: string
  codeUri: string
  configSnapshot: Prisma.JsonValue
  timeLimitMs: number
  memoryLimitMb: number
}) {
  return {
    type: "testdata_generation",
    taskId: input.task.id,
    problemId: input.task.problemId,
    problemVersionId: input.task.problemVersionId,
    standardSolutionId: input.task.standardSolutionId,
    mode: input.task.mode,
    seed: input.task.seed,
    queueName: input.task.queueName,
    plannedCaseCount: input.task.plannedCaseCount,
    language: input.language,
    codeUri: input.codeUri,
    config: input.configSnapshot,
    timeLimitMs: input.timeLimitMs,
    memoryLimitMb: input.memoryLimitMb,
  }
}

export function planCountFromConfig(configSnapshot: Prisma.JsonValue, seed: string) {
  const { plans } = validateAndPlanTestdataConfig(configSnapshot, seed)
  return plans.length
}

export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}
