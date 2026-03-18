import { execFile } from "child_process"
import { promisify } from "util"
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "fs/promises"
import path from "path"
import { tmpdir } from "os"
import { Prisma, type FileAsset } from "@prisma/client"
import { createStoredFileAsset } from "./file-assets.js"

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_PACKAGE_BYTES = 200 * 1024 * 1024
const DEFAULT_EXEC_BUFFER_BYTES = 4 * 1024 * 1024

function readLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const MAX_TESTDATA_PACKAGE_BYTES = readLimit(
  process.env.MAX_TESTDATA_PACKAGE_BYTES ?? process.env.MAX_TESTCASE_ZIP_BYTES,
  DEFAULT_MAX_PACKAGE_BYTES
)

type TaskPackageContext = {
  taskId: string
  problemId: string
  problemSlug: string
  problemTitle: string
  problemVersionId: string
  version: number
  mode: string
  seed: string | null
  standardSolution: {
    id: string
    label: string
    language: string
  }
  requestedById: string
  plannedCaseCount: number
  persistedCaseCount: number
  createdAt: Date
  finishedAt: Date | null
}

type PackagedCase = {
  ordinal: number
  title: string | null
  groupKey: string | null
  score: number
  isSample: boolean
  isPretest: boolean
  visible: boolean
  caseType: number
  subtaskId: number | null
  groupId: string | null
  orderIndex: number | null
  inputAssetUri: string
  expectedOutputAssetUri: string
}

class TestdataPackageBuildError extends Error {}

function toFilePath(uri: string) {
  if (!uri.startsWith("file://")) {
    throw new TestdataPackageBuildError(`unsupported uri: ${uri}`)
  }
  try {
    return decodeURIComponent(new URL(uri).pathname)
  } catch {
    return uri.replace("file://", "")
  }
}

function slugifyFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task"
}

export async function createTestdataTaskPackageAsset(input: {
  task: TaskPackageContext
  cases: PackagedCase[]
}): Promise<FileAsset> {
  if (input.cases.length === 0) {
    throw new TestdataPackageBuildError("task_cases_missing")
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-testdata-package-"))

  try {
    const rootName = slugifyFilePart(
      `${input.task.problemSlug || input.task.problemId}-v${input.task.version}-task-${input.task.taskId.slice(0, 8)}`
    )
    const rootDir = path.join(workDir, rootName)
    const casesDir = path.join(rootDir, "cases")
    await mkdir(casesDir, { recursive: true })

    const manifest = {
      version: 1,
      task: {
        id: input.task.taskId,
        problemId: input.task.problemId,
        problemSlug: input.task.problemSlug,
        problemTitle: input.task.problemTitle,
        problemVersionId: input.task.problemVersionId,
        version: input.task.version,
        mode: input.task.mode,
        seed: input.task.seed,
        standardSolution: input.task.standardSolution,
        plannedCaseCount: input.task.plannedCaseCount,
        persistedCaseCount: input.task.persistedCaseCount,
        createdAt: input.task.createdAt,
        finishedAt: input.task.finishedAt ?? new Date(),
      },
      cases: [] as Array<{
        ordinal: number
        title: string | null
        groupKey: string | null
        score: number
        isSample: boolean
        isPretest: boolean
        visible: boolean
        caseType: number
        subtaskId: number | null
        groupId: string | null
        orderIndex: number | null
        input: string
        output: string
      }>,
    }

    for (const item of input.cases) {
      const ordinal = String(item.ordinal).padStart(3, "0")
      const inputTarget = path.join(casesDir, `${ordinal}.in`)
      const outputTarget = path.join(casesDir, `${ordinal}.out`)
      await copyFile(toFilePath(item.inputAssetUri), inputTarget)
      await copyFile(toFilePath(item.expectedOutputAssetUri), outputTarget)
      manifest.cases.push({
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
        input: `cases/${ordinal}.in`,
        output: `cases/${ordinal}.out`,
      })
    }

    await writeFile(path.join(rootDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

    const packageName = `${rootName}.zip`
    const packagePath = path.join(workDir, packageName)
    await execFileAsync("zip", ["-r", "-q", packagePath, rootName], {
      cwd: workDir,
      maxBuffer: DEFAULT_EXEC_BUFFER_BYTES,
    })

    const packageInfo = await stat(packagePath)
    if (packageInfo.size > MAX_TESTDATA_PACKAGE_BYTES) {
      throw new TestdataPackageBuildError(
        `package size ${packageInfo.size} exceeds ${MAX_TESTDATA_PACKAGE_BYTES}`
      )
    }

    const buffer = await readFile(packagePath)
    return createStoredFileAsset({
      prefix: "testdata-packages",
      fileName: packageName,
      content: buffer,
      kind: "TASK_PACKAGE",
      mimeType: "application/zip",
      createdById: input.task.requestedById,
      extension: "zip",
      metadata: {
        taskId: input.task.taskId,
        problemVersionId: input.task.problemVersionId,
        packageType: "testdata_task_zip",
      } satisfies Prisma.InputJsonValue,
    })
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
