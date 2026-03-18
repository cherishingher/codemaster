import { execFile } from "child_process"
import { promisify } from "util"
import { copyFile, mkdtemp, readFile, rm, stat, writeFile, mkdir } from "fs/promises"
import path from "path"
import { tmpdir } from "os"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createStoredFileAsset } from "@/lib/file-assets"

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_PACKAGE_BYTES = 200 * 1024 * 1024
const DEFAULT_EXEC_BUFFER_BYTES = 4 * 1024 * 1024

function readLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export const MAX_TESTDATA_PACKAGE_BYTES = readLimit(
  process.env.MAX_TESTDATA_PACKAGE_BYTES ?? process.env.MAX_TESTCASE_ZIP_BYTES,
  DEFAULT_MAX_PACKAGE_BYTES
)

class TestdataPackageError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message?: string) {
    super(message ?? code)
    this.status = status
    this.code = code
  }
}

function toFilePath(uri: string) {
  if (!uri.startsWith("file://")) {
    throw new TestdataPackageError(400, "unsupported_file_uri", `unsupported uri: ${uri}`)
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

async function readPackageBuffer(uri: string) {
  return readFile(toFilePath(uri))
}

export async function getOrCreateTestdataTaskPackage(taskId: string) {
  const task = await db.testdataGenerationTask.findUnique({
    where: { id: taskId },
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
      packageAsset: {
        select: { id: true, uri: true, fileName: true, byteSize: true },
      },
      cases: {
        orderBy: { ordinal: "asc" },
        include: {
          inputAsset: {
            select: { id: true, uri: true, fileName: true },
          },
          expectedOutputAsset: {
            select: { id: true, uri: true, fileName: true },
          },
        },
      },
    },
  })

  if (!task) {
    throw new TestdataPackageError(404, "task_not_found")
  }
  if (task.status !== "SUCCEEDED") {
    throw new TestdataPackageError(409, "task_not_ready")
  }
  if (!task.cases.length) {
    throw new TestdataPackageError(409, "task_cases_missing")
  }

  if (task.packageAsset?.uri) {
    return {
      task,
      asset: task.packageAsset,
      buffer: await readPackageBuffer(task.packageAsset.uri),
      generated: false,
    }
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-testdata-package-"))
  try {
    const rootName = slugifyFilePart(
      `${task.problem.slug || task.problem.id}-v${task.problemVersion.version}-task-${task.id.slice(0, 8)}`
    )
    const rootDir = path.join(workDir, rootName)
    const casesDir = path.join(rootDir, "cases")
    await mkdir(casesDir, { recursive: true })

    const manifest = {
      version: 1,
      task: {
        id: task.id,
        problemId: task.problemId,
        problemSlug: task.problem.slug,
        problemTitle: task.problem.title,
        problemVersionId: task.problemVersionId,
        version: task.problemVersion.version,
        mode: task.mode,
        seed: task.seed,
        standardSolution: task.standardSolution,
        plannedCaseCount: task.plannedCaseCount,
        persistedCaseCount: task.persistedCaseCount,
        createdAt: task.createdAt,
        finishedAt: task.finishedAt,
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

    for (const item of task.cases) {
      if (!item.inputAsset?.uri || !item.expectedOutputAsset?.uri) {
        throw new TestdataPackageError(409, "task_case_assets_missing", `case ${item.ordinal} assets missing`)
      }
      const ordinal = String(item.ordinal).padStart(3, "0")
      const inputTarget = path.join(casesDir, `${ordinal}.in`)
      const outputTarget = path.join(casesDir, `${ordinal}.out`)
      await copyFile(toFilePath(item.inputAsset.uri), inputTarget)
      await copyFile(toFilePath(item.expectedOutputAsset.uri), outputTarget)
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

    await writeFile(
      path.join(rootDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    )

    const packageName = `${rootName}.zip`
    const packagePath = path.join(workDir, packageName)
    await execFileAsync(
      "zip",
      ["-r", "-q", packagePath, rootName],
      { cwd: workDir, maxBuffer: DEFAULT_EXEC_BUFFER_BYTES }
    )

    const packageInfo = await stat(packagePath)
    if (packageInfo.size > MAX_TESTDATA_PACKAGE_BYTES) {
      throw new TestdataPackageError(
        400,
        "package_too_large",
        `package size ${packageInfo.size} exceeds ${MAX_TESTDATA_PACKAGE_BYTES}`
      )
    }

    const buffer = await readFile(packagePath)
    const asset = await createStoredFileAsset({
      prefix: "testdata-packages",
      fileName: packageName,
      content: buffer,
      kind: "TASK_PACKAGE",
      mimeType: "application/zip",
      createdById: task.requestedById,
      extension: "zip",
      metadata: {
        taskId: task.id,
        problemVersionId: task.problemVersionId,
        smokeTest: false,
        packageType: "testdata_task_zip",
      } satisfies Prisma.InputJsonValue,
    })

    await db.testdataGenerationTask.update({
      where: { id: task.id },
      data: {
        packageAssetId: asset.id,
        resultSummary: {
          ...(task.resultSummary && typeof task.resultSummary === "object" ? task.resultSummary : {}),
          packageAssetId: asset.id,
          packageGeneratedAt: new Date().toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    })

    return {
      task,
      asset,
      buffer,
      generated: true,
    }
  } catch (error) {
    if (error instanceof TestdataPackageError) {
      throw error
    }
    throw new TestdataPackageError(
      500,
      "package_build_failed",
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export { TestdataPackageError }
