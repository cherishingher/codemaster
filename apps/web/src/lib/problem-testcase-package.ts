import { execFile } from "child_process"
import { promisify } from "util"
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "fs/promises"
import path from "path"
import { tmpdir } from "os"

const execFileAsync = promisify(execFile)

const DEFAULT_MAX_PACKAGE_BYTES = 200 * 1024 * 1024
const DEFAULT_EXEC_BUFFER_BYTES = 4 * 1024 * 1024

function readLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export const MAX_PROBLEM_TESTCASE_PACKAGE_BYTES = readLimit(
  process.env.MAX_TESTCASE_ZIP_BYTES ?? process.env.MAX_TESTDATA_PACKAGE_BYTES,
  DEFAULT_MAX_PACKAGE_BYTES,
)

export class ProblemTestcasePackageError extends Error {
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
    throw new ProblemTestcasePackageError(400, "unsupported_file_uri", `unsupported uri: ${uri}`)
  }
  try {
    return decodeURIComponent(new URL(uri).pathname)
  } catch {
    return uri.replace("file://", "")
  }
}

function slugifyFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "problem"
  )
}

type PackagedProblemTestcase = {
  id: string
  title: string | null
  caseType: number
  visible: boolean
  score: number
  groupId: string | null
  isSample: boolean
  orderIndex: number | null
  inputUri: string
  outputUri: string
}

export async function buildProblemTestcasePackage(input: {
  problem: {
    id: string
    slug: string
    title: string
  }
  version: {
    id: string
    version: number
  }
  testcases: PackagedProblemTestcase[]
}) {
  if (input.testcases.length === 0) {
    throw new ProblemTestcasePackageError(409, "testcases_not_configured")
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-problem-testcases-"))

  try {
    const rootName = slugifyFilePart(`${input.problem.slug || input.problem.id}-v${input.version.version}-testcases`)
    const rootDir = path.join(workDir, rootName)
    const casesDir = path.join(rootDir, "cases")
    await mkdir(casesDir, { recursive: true })

    const manifest = {
      version: 1,
      problem: {
        id: input.problem.id,
        slug: input.problem.slug,
        title: input.problem.title,
      },
      problemVersion: {
        id: input.version.id,
        version: input.version.version,
      },
      cases: [] as Array<{
        ordinal: number
        testcaseId: string
        title: string | null
        caseType: number
        visible: boolean
        score: number
        groupId: string | null
        isSample: boolean
        orderIndex: number | null
        input: string
        output: string
      }>,
    }

    for (const [index, testcase] of input.testcases.entries()) {
      const ordinal = index + 1
      const caseFile = String(ordinal).padStart(3, "0")
      const inputTarget = path.join(casesDir, `${caseFile}.in`)
      const outputTarget = path.join(casesDir, `${caseFile}.out`)

      await copyFile(toFilePath(testcase.inputUri), inputTarget)
      await copyFile(toFilePath(testcase.outputUri), outputTarget)

      manifest.cases.push({
        ordinal,
        testcaseId: testcase.id,
        title: testcase.title,
        caseType: testcase.caseType,
        visible: testcase.visible,
        score: testcase.score,
        groupId: testcase.groupId,
        isSample: testcase.isSample,
        orderIndex: testcase.orderIndex,
        input: `cases/${caseFile}.in`,
        output: `cases/${caseFile}.out`,
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
    if (packageInfo.size > MAX_PROBLEM_TESTCASE_PACKAGE_BYTES) {
      throw new ProblemTestcasePackageError(
        400,
        "package_too_large",
        `package size ${packageInfo.size} exceeds ${MAX_PROBLEM_TESTCASE_PACKAGE_BYTES}`,
      )
    }

    return {
      fileName: packageName,
      buffer: await readFile(packagePath),
    }
  } catch (error) {
    if (error instanceof ProblemTestcasePackageError) {
      throw error
    }
    throw new ProblemTestcasePackageError(
      500,
      "testcase_package_build_failed",
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
