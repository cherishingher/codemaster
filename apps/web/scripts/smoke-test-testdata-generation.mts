import { createHash, randomUUID } from "crypto"
import { readFile, unlink } from "fs/promises"
import * as dbModule from "../src/lib/db"
import * as fileAssetsModule from "../src/lib/file-assets"
import * as testdataGenModule from "../src/lib/testdata-gen"
import * as taskUtilsModule from "../src/lib/testdata-gen/task-utils"

const dbExports = (dbModule as Record<string, unknown>).default as Record<string, unknown> | undefined
const fileAssetExports = (fileAssetsModule as Record<string, unknown>).default as Record<string, unknown> | undefined
const testdataGenExports = (testdataGenModule as Record<string, unknown>).default as Record<string, unknown> | undefined
const taskUtilsExports = (taskUtilsModule as Record<string, unknown>).default as Record<string, unknown> | undefined

const { db } = (dbExports ?? (dbModule as Record<string, unknown>)) as {
  db: typeof import("../src/lib/db").db
}
const { createStoredFileAsset } = (fileAssetExports ?? (fileAssetsModule as Record<string, unknown>)) as {
  createStoredFileAsset: typeof import("../src/lib/file-assets").createStoredFileAsset
}
const { generatePlannedCase, validateAndPlanTestdataConfig } = (testdataGenExports ??
  (testdataGenModule as Record<string, unknown>)) as {
  generatePlannedCase: typeof import("../src/lib/testdata-gen").generatePlannedCase
  validateAndPlanTestdataConfig: typeof import("../src/lib/testdata-gen").validateAndPlanTestdataConfig
}
const {
  buildSolutionSnapshot,
  buildTestdataRequestFingerprint,
  resolveTaskSeed,
  summarizeTaskForQueue,
  TESTDATA_QUEUE_NAME,
  toInputJsonValue,
} = (taskUtilsExports ?? (taskUtilsModule as Record<string, unknown>)) as {
  buildSolutionSnapshot: typeof import("../src/lib/testdata-gen/task-utils").buildSolutionSnapshot
  buildTestdataRequestFingerprint: typeof import("../src/lib/testdata-gen/task-utils").buildTestdataRequestFingerprint
  resolveTaskSeed: typeof import("../src/lib/testdata-gen/task-utils").resolveTaskSeed
  summarizeTaskForQueue: typeof import("../src/lib/testdata-gen/task-utils").summarizeTaskForQueue
  TESTDATA_QUEUE_NAME: typeof import("../src/lib/testdata-gen/task-utils").TESTDATA_QUEUE_NAME
  toInputJsonValue: typeof import("../src/lib/testdata-gen/task-utils").toInputJsonValue
}

type RunnerMode = "host" | "docker"

function parseMode(): RunnerMode {
  const modeIndex = process.argv.findIndex((arg) => arg === "--mode")
  const modeValue = modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined
  if (modeValue === "docker" || modeValue === "host") {
    return modeValue
  }
  return "host"
}

function parseKeepArtifacts() {
  return process.argv.includes("--keep")
}

function hashSource(source: string) {
  return createHash("sha256").update(source).digest("hex")
}

function filePathFromUri(uri: string | null | undefined) {
  if (!uri?.startsWith("file://")) return null
  return uri.replace("file://", "")
}

function expectedSumOutput(input: string) {
  const values = input
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseInt(token, 10))
  const n = values[0] ?? 0
  const sum = values.slice(1, 1 + n).reduce((acc, value) => acc + value, 0)
  return `${sum}\n`
}

async function cleanupFileUris(uris: string[]) {
  await Promise.all(
    [...new Set(uris)]
      .map((uri) => filePathFromUri(uri))
      .filter((filepath): filepath is string => Boolean(filepath))
      .map(async (filepath) => {
        await unlink(filepath).catch(() => undefined)
      })
  )
}

async function main() {
  const mode = parseMode()
  const keepArtifacts = parseKeepArtifacts()
  process.env.TESTDATA_RUNNER_MODE = mode
  if (mode === "docker" && !process.env.TESTDATA_RUNNER_IMAGE) {
    process.env.TESTDATA_RUNNER_IMAGE = "codemaster-testdata-runner:latest"
  }

  const { handleTestdataGenerationJob } = await import("../../../services/judge-agent/src/jobs/testdata-generation")

  const createdFileUris: string[] = []
  let createdUserId: string | null = null
  let problemId: string | null = null
  let problemVersionId: string | null = null
  let standardSolutionId: string | null = null
  let taskId: string | null = null

  try {
    let operator = await db.user.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    if (!operator) {
      const tempUser = await db.user.create({
        data: {
          email: `testdata-smoke-${randomUUID()}@local.invalid`,
          password: "smoke-test-password",
          name: "Testdata Smoke",
        },
        select: { id: true },
      })
      operator = tempUser
      createdUserId = tempUser.id
    }

    const slug = `testdata-smoke-${mode}-${Date.now()}`
    const problem = await db.problem.create({
      data: {
        slug,
        title: `Testdata Smoke ${mode}`,
        difficulty: 1,
      },
      select: { id: true },
    })
    problemId = problem.id

    const version = await db.problemVersion.create({
      data: {
        problemId: problem.id,
        version: 1,
        statement: "Read n followed by n integers and print their sum.",
        inputFormat: "The first line contains n. The second line contains n integers.",
        outputFormat: "Print the sum.",
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        testdataGenerationConfig: {
          version: 1,
          groups: [
            {
              key: "sum",
              title: "Sum cases",
              count: 2,
              score: 50,
              generator: {
                type: "array",
                params: {
                  n: { min: 3, max: 5 },
                  value: { min: 1, max: 9 },
                },
              },
            },
          ],
        },
      },
      select: {
        id: true,
        problemId: true,
        timeLimitMs: true,
        memoryLimitMb: true,
        testdataGenerationConfig: true,
      },
    })
    problemVersionId = version.id

    await db.problem.update({
      where: { id: problem.id },
      data: { currentVersionId: version.id },
    })

    const source = [
      "#include <iostream>",
      "using namespace std;",
      "int main() {",
      "  ios::sync_with_stdio(false);",
      "  cin.tie(nullptr);",
      "  int n = 0;",
      "  if (!(cin >> n)) return 0;",
      "  long long sum = 0;",
      "  for (int i = 0; i < n; i++) {",
      "    long long x = 0;",
      "    cin >> x;",
      "    sum += x;",
      "  }",
      '  cout << sum << "\\n";',
      "  return 0;",
      "}",
    ].join("\n")

    const sourceAsset = await createStoredFileAsset({
      prefix: "reference-solutions",
      fileName: `${slug}.cpp`,
      content: source,
      kind: "SOURCE_CODE",
      mimeType: "text/x-c++src",
      createdById: operator.id,
      metadata: toInputJsonValue({ smokeTest: true, mode }),
    })
    createdFileUris.push(sourceAsset.uri)

    const standardSolution = await db.standardSolution.create({
      data: {
        problemVersionId: version.id,
        label: `Smoke ${mode}`,
        language: "cpp17",
        sourceAssetId: sourceAsset.id,
        sourceHash: hashSource(source),
        uploadedById: operator.id,
        isPrimary: true,
      },
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
    standardSolutionId = standardSolution.id

    const seed = resolveTaskSeed(`smoke-${mode}-${randomUUID()}`)
    const { config, plans } = validateAndPlanTestdataConfig(version.testdataGenerationConfig, seed)

    const generatedInputs = await Promise.all(
      plans.map(async (plan) => {
        const generated = generatePlannedCase(plan)
        const inputAsset = await createStoredFileAsset({
          prefix: "generated-inputs",
          fileName: `${plan.groupKey}-${String(plan.ordinal).padStart(3, "0")}.in`,
          content: generated.input,
          kind: "TESTCASE_INPUT",
          mimeType: "text/plain",
          createdById: operator.id,
          metadata: toInputJsonValue({
            smokeTest: true,
            mode,
            taskSeed: plan.caseSeed,
            generator: plan.generator.type,
            planOrdinal: plan.ordinal,
          }),
        })
        createdFileUris.push(inputAsset.uri)
        return { plan, generated, inputAsset }
      })
    )

    const requestFingerprint = buildTestdataRequestFingerprint({
      versionId: version.id,
      standardSolutionId: standardSolution.id,
      mode: "APPEND",
      seed,
      configSnapshot: config,
    })

    const task = await db.$transaction(async (tx) => {
      const createdTask = await tx.testdataGenerationTask.create({
        data: {
          problemId: version.problemId,
          problemVersionId: version.id,
          standardSolutionId: standardSolution.id,
          requestedById: operator.id,
          status: "PENDING",
          stage: "VALIDATE_CONFIG",
          mode: "APPEND",
          queueName: TESTDATA_QUEUE_NAME,
          seed,
          requestFingerprint,
          configSnapshot: config,
          solutionSnapshot: buildSolutionSnapshot(standardSolution, standardSolution.sourceAsset),
          plannedCaseCount: generatedInputs.length,
          generatedCaseCount: generatedInputs.length,
        },
      })

      await tx.testdataCase.createMany({
        data: generatedInputs.map(({ plan, generated, inputAsset }) => ({
          taskId: createdTask.id,
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
          taskId: createdTask.id,
          sequenceNo: 1,
          level: "INFO",
          stage: "GENERATE_INPUTS",
          code: "inputs_prepared",
          message: `Prepared ${generatedInputs.length} generated inputs`,
          detail: toInputJsonValue({ smokeTest: true, mode, seed }),
        },
      })

      return createdTask
    })
    taskId = task.id

    await handleTestdataGenerationJob(
      summarizeTaskForQueue({
        task,
        language: standardSolution.language,
        codeUri: standardSolution.sourceAsset.uri,
        configSnapshot: config,
        timeLimitMs: version.timeLimitMs,
        memoryLimitMb: version.memoryLimitMb,
      }),
      `smoke-${mode}`
    )

    const [finalTask, finalCases, finalTestcases] = await Promise.all([
      db.testdataGenerationTask.findUnique({
        where: { id: task.id },
        include: {
          packageAsset: {
            select: { id: true, uri: true, fileName: true },
          },
          cases: {
            orderBy: { ordinal: "asc" },
            include: {
              expectedOutputAsset: {
                select: { id: true, uri: true },
              },
              runtimeStderrAsset: {
                select: { id: true, uri: true },
              },
            },
          },
        },
      }),
      db.testdataCase.findMany({
        where: { taskId: task.id },
        orderBy: { ordinal: "asc" },
      }),
      db.testcase.findMany({
        where: { generationTaskId: task.id },
        orderBy: { generationOrdinal: "asc" },
      }),
    ])

    if (!finalTask) {
      throw new Error("smoke_task_missing")
    }
    if (finalTask.status !== "SUCCEEDED") {
      throw new Error(`smoke_task_failed:${finalTask.status}:${finalTask.errorCode ?? "unknown"}`)
    }
    if (finalCases.length !== generatedInputs.length || finalTestcases.length !== generatedInputs.length) {
      throw new Error("smoke_case_count_mismatch")
    }
    if (!finalCases.every((item) => item.status === "PERSISTED" && item.executionStatus === "SUCCESS")) {
      throw new Error("smoke_case_status_invalid")
    }
    if (!finalTask.packageAsset?.uri) {
      throw new Error("smoke_package_missing")
    }

    const firstOutputUri = finalTask.cases[0]?.expectedOutputAsset?.uri
    if (!firstOutputUri) {
      throw new Error("smoke_first_output_missing")
    }
    const firstOutput = await readFile(filePathFromUri(firstOutputUri)!, "utf8")
    const expectedOutput = expectedSumOutput(generatedInputs[0].generated.input)
    if (firstOutput !== expectedOutput) {
      throw new Error(`smoke_output_mismatch:expected=${JSON.stringify(expectedOutput)} actual=${JSON.stringify(firstOutput)}`)
    }

    const allUris = [
      ...createdFileUris,
      finalTask.packageAsset.uri,
      ...finalTask.cases.flatMap((item) => [
        item.expectedOutputAsset?.uri ?? null,
        item.runtimeStderrAsset?.uri ?? null,
      ]),
    ].filter((uri): uri is string => Boolean(uri))

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          taskId: finalTask.id,
          problemVersionId: version.id,
          publishedCaseCount: finalTestcases.length,
          packageFileName: finalTask.packageAsset.fileName,
          firstOutput: firstOutput.trim(),
        },
        null,
        2
      )
    )

    if (!keepArtifacts) {
      await db.$transaction(async (tx) => {
        await tx.testcase.deleteMany({ where: { generationTaskId: task.id } })
        await tx.testdataGenerationLog.deleteMany({ where: { taskId: task.id } })
        await tx.testdataCase.deleteMany({ where: { taskId: task.id } })
        await tx.testdataGenerationTask.delete({ where: { id: task.id } })
        await tx.standardSolution.delete({ where: { id: standardSolution.id } })
        await tx.problem.update({
          where: { id: problem.id },
          data: { currentVersionId: null },
        })
        await tx.problemVersion.delete({ where: { id: version.id } })
        await tx.problem.delete({ where: { id: problem.id } })
      })

      const fileAssetIds = await db.fileAsset.findMany({
        where: { uri: { in: allUris } },
        select: { id: true },
      })
      if (fileAssetIds.length > 0) {
        await db.fileAsset.deleteMany({
          where: { id: { in: fileAssetIds.map((item) => item.id) } },
        })
      }

      await cleanupFileUris(allUris)

      taskId = null
      standardSolutionId = null
      problemVersionId = null
      problemId = null
    }
  } finally {
    if (!keepArtifacts) {
      if (taskId) {
        await db.testcase.deleteMany({ where: { generationTaskId: taskId } }).catch(() => undefined)
        await db.testdataGenerationLog.deleteMany({ where: { taskId } }).catch(() => undefined)
        await db.testdataCase.deleteMany({ where: { taskId } }).catch(() => undefined)
        await db.testdataGenerationTask.delete({ where: { id: taskId } }).catch(() => undefined)
      }
      if (standardSolutionId) {
        await db.standardSolution.delete({ where: { id: standardSolutionId } }).catch(() => undefined)
      }
      if (problemId && problemVersionId) {
        await db.problem.update({
          where: { id: problemId },
          data: { currentVersionId: null },
        }).catch(() => undefined)
        await db.problemVersion.delete({ where: { id: problemVersionId } }).catch(() => undefined)
        await db.problem.delete({ where: { id: problemId } }).catch(() => undefined)
      }
      if (createdUserId) {
        await db.user.delete({ where: { id: createdUserId } }).catch(() => undefined)
      }
      await cleanupFileUris(createdFileUris).catch(() => undefined)
    }
    await db.$disconnect()
  }
}

await main()
