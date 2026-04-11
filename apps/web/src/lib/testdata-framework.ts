import { execFile } from "node:child_process"
import { access } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type SupportedTestdataFramework = "cyaron"

type ProblemContext = {
  id: string
  slug: string
  title: string
  source?: string | null
}

function distributeGroupCounts(total: number) {
  if (total <= 1) {
    return {
      tiny: 1,
      dense: 0,
      random: 0,
      max: 0,
    }
  }

  if (total === 2) {
    return {
      tiny: 1,
      dense: 0,
      random: 1,
      max: 0,
    }
  }

  if (total === 3) {
    return {
      tiny: 1,
      dense: 1,
      random: 0,
      max: 1,
    }
  }

  let remaining = total - 2
  const dense = Math.max(1, Math.floor(remaining * 0.25))
  const max = 1
  remaining -= dense
  const random = Math.max(1, remaining)

  return {
    tiny: 1,
    dense,
    random,
    max,
  }
}

function buildPerCaseScore(testcaseCount: number, totalScore?: number) {
  const resolvedTotal = totalScore ?? 100
  if (resolvedTotal % testcaseCount !== 0) {
    throw new Error("equal_score_not_divisible")
  }
  return resolvedTotal / testcaseCount
}

export async function findRepositoryRoot() {
  let current = process.cwd()
  for (;;) {
    const packageJsonPath = path.join(current, "package.json")
    try {
      const { default: fs } = await import("node:fs/promises")
      const raw = await fs.readFile(packageJsonPath, "utf8")
      const pkg = JSON.parse(raw) as { workspaces?: unknown; name?: string }
      if (Array.isArray(pkg.workspaces) || pkg.name === "codemaster") {
        return current
      }
    } catch {
      // keep walking upward
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return process.cwd()
    }
    current = parent
  }
}

export function defaultFrameworkTargetDir(problem: ProblemContext) {
  const base = problem.slug?.trim() || problem.id
  return `problem-generators/custom/${base}`
}

export function normalizeFrameworkTargetDir(raw: string | undefined, problem: ProblemContext) {
  const candidate = (raw?.trim() || defaultFrameworkTargetDir(problem)).replace(/\\/g, "/")
  const normalized = candidate.replace(/^\/+/, "")
  if (!normalized.startsWith("problem-generators/")) {
    throw new Error("framework_target_dir_invalid")
  }
  if (normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("framework_target_dir_invalid")
  }
  return normalized
}

export async function frameworkTargetDirExists(relativeDir: string) {
  const repoRoot = await findRepositoryRoot()
  const absoluteDir = path.resolve(repoRoot, relativeDir)
  try {
    await access(absoluteDir)
    return true
  } catch {
    return false
  }
}

export async function scaffoldCyaronGenerator(input: {
  problem: ProblemContext
  targetDir: string
  force?: boolean
}) {
  const repoRoot = await findRepositoryRoot()
  const exists = await frameworkTargetDirExists(input.targetDir)

  if (exists && !input.force) {
    return {
      scaffolded: false,
      skipped: true,
      targetDir: input.targetDir,
    }
  }

  const scriptPath = path.join(repoRoot, "scripts", "scaffold-cyaron-generator.mjs")
  const args = [
    scriptPath,
    "--slug",
    input.problem.slug || input.problem.id,
    "--title",
    input.problem.title,
    "--source",
    input.problem.source?.trim() || `local:${input.problem.slug || input.problem.id}`,
    "--target-dir",
    input.targetDir,
  ]

  if (input.force) {
    args.push("--force")
  }

  await execFileAsync(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
  })

  return {
    scaffolded: true,
    skipped: false,
    targetDir: input.targetDir,
  }
}

export function buildCyaronFrameworkDraft(input: {
  targetDir: string
  testcaseCount: number
  totalScore?: number
}) {
  const counts = distributeGroupCounts(input.testcaseCount)
  const score = buildPerCaseScore(input.testcaseCount, input.totalScore)

  const groups = [
    counts.tiny > 0
      ? {
          key: "tiny-edge",
          title: "最小边界",
          count: counts.tiny,
          score,
          visible: false,
          groupId: "edge",
          generator: {
            type: "external" as const,
            params: {
              driver: "cyaron" as const,
              cwd: input.targetDir,
              command: ["python3", "gen.py", "--mode", "tiny-edge", "--seed", "{{caseSeed}}"],
              outputMode: "text" as const,
              context: {
                profile: "tiny-edge",
              },
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        }
      : null,
    counts.dense > 0
      ? {
          key: "dense-duplicates",
          title: "重复值 / 卡常边界",
          count: counts.dense,
          score,
          visible: false,
          groupId: "edge",
          generator: {
            type: "external" as const,
            params: {
              driver: "cyaron" as const,
              cwd: input.targetDir,
              command: ["python3", "gen.py", "--mode", "dense-duplicates", "--seed", "{{caseSeed}}"],
              outputMode: "text" as const,
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        }
      : null,
    counts.random > 0
      ? {
          key: "random",
          title: "随机数据",
          count: counts.random,
          score,
          visible: false,
          groupId: "random",
          generator: {
            type: "external" as const,
            params: {
              driver: "cyaron" as const,
              cwd: input.targetDir,
              command: ["python3", "gen.py", "--mode", "default", "--seed", "{{caseSeed}}"],
              outputMode: "text" as const,
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        }
      : null,
    counts.max > 0
      ? {
          key: "max-random",
          title: "最大规模",
          count: counts.max,
          score,
          visible: false,
          groupId: "stress",
          generator: {
            type: "external" as const,
            params: {
              driver: "cyaron" as const,
              cwd: input.targetDir,
              command: ["python3", "gen.py", "--mode", "max-random", "--seed", "{{caseSeed}}"],
              outputMode: "text" as const,
              validator: {
                command: ["python3", "validator.py"],
                timeoutMs: 5000,
              },
            },
          },
        }
      : null,
  ].filter(Boolean)

  return {
    version: 1 as const,
    groups,
  }
}
