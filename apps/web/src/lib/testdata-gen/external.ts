import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type {
  CasePlan,
  ExternalCommandConfig,
  ExternalGeneratorParams,
  GeneratedCase,
  JsonObject,
  TestdataGenerationRuntimeContext,
} from "@/lib/testdata-gen/types"

const MAX_OUTPUT_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 20_000

type ExternalCommandResult = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
  outputLimitExceeded: boolean
}

type TemplateContext = Record<string, unknown>

let repoRootCache: string | null = null

function getValueByPath(value: unknown, pointer: string): unknown {
  return pointer.split(".").reduce<unknown>((current, segment) => {
    if (!segment) return current
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, value)
}

function stringifyTemplateValue(value: unknown) {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function renderTemplate(template: string, context: TemplateContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, pointer: string) => {
    return stringifyTemplateValue(getValueByPath(context, pointer))
  })
}

async function resolveRepositoryRoot() {
  if (repoRootCache) {
    return repoRootCache
  }

  let current = process.cwd()
  for (;;) {
    const packageJsonPath = path.join(current, "package.json")
    try {
      const raw = await readFile(packageJsonPath, "utf8")
      const pkg = JSON.parse(raw) as { workspaces?: unknown; name?: string }
      if (Array.isArray(pkg.workspaces) || pkg.name === "codemaster") {
        repoRootCache = current
        return current
      }
    } catch {
      // Continue walking upward until we hit the filesystem root.
    }

    const parent = path.dirname(current)
    if (parent === current) {
      repoRootCache = process.cwd()
      return repoRootCache
    }
    current = parent
  }
}

async function resolveWorkingDirectory(cwd?: string) {
  const repoRoot = await resolveRepositoryRoot()
  if (!cwd) {
    return repoRoot
  }
  return path.isAbsolute(cwd) ? cwd : path.resolve(repoRoot, cwd)
}

function appendOutput(current: string, chunk: Buffer | string, remainingBytes: number) {
  if (remainingBytes <= 0) {
    return { value: current, writtenBytes: 0, truncated: true }
  }

  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
  const slice = buffer.subarray(0, remainingBytes)
  return {
    value: current + slice.toString("utf8"),
    writtenBytes: slice.length,
    truncated: buffer.length > remainingBytes,
  }
}

async function runExternalCommand(
  config: ExternalCommandConfig,
  templateContext: TemplateContext,
  payload: Record<string, unknown>,
  input?: string,
): Promise<ExternalCommandResult> {
  const cwd = await resolveWorkingDirectory(config.cwd)
  const tempDir = await mkdtemp(path.join(tmpdir(), "codemaster-extgen-"))
  const contextPath = path.join(tempDir, "context.json")

  await writeFile(contextPath, JSON.stringify(payload, null, 2), "utf8")

  const renderedCommand = config.command.map((part) => renderTemplate(part, templateContext))
  const [command, ...args] = renderedCommand
  const env = {
    ...process.env,
    TESTDATA_CONTEXT_PATH: contextPath,
    TESTDATA_REPO_ROOT: await resolveRepositoryRoot(),
    TESTDATA_CASE_SEED: String(templateContext.caseSeed ?? ""),
    TESTDATA_GROUP_KEY: String(templateContext.groupKey ?? ""),
    TESTDATA_ORDINAL: String(templateContext.ordinal ?? ""),
    ...(config.env
      ? Object.fromEntries(
          Object.entries(config.env).map(([key, value]) => [key, renderTemplate(value, templateContext)])
        )
      : {}),
  }

  const stdin = config.stdinTemplate
    ? renderTemplate(config.stdinTemplate, templateContext)
    : input

  try {
    return await new Promise<ExternalCommandResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env,
        stdio: "pipe",
      })

      let stdout = ""
      let stderr = ""
      let stdoutBytes = 0
      let stderrBytes = 0
      let finished = false
      let timedOut = false
      let outputLimitExceeded = false

      const timeout = setTimeout(() => {
        if (!finished) {
          timedOut = true
          child.kill("SIGKILL")
        }
      }, config.timeoutMs ?? DEFAULT_TIMEOUT_MS)

      const handleChunk = (stream: "stdout" | "stderr", chunk: Buffer | string) => {
        if (finished || outputLimitExceeded) {
          return
        }

        const remaining = MAX_OUTPUT_BYTES - stdoutBytes - stderrBytes
        const appended = appendOutput(stream === "stdout" ? stdout : stderr, chunk, remaining)
        if (stream === "stdout") {
          stdout = appended.value
          stdoutBytes += appended.writtenBytes
        } else {
          stderr = appended.value
          stderrBytes += appended.writtenBytes
        }

        if (appended.truncated || stdoutBytes + stderrBytes >= MAX_OUTPUT_BYTES) {
          outputLimitExceeded = true
          child.kill("SIGKILL")
        }
      }

      child.stdout.on("data", (chunk) => handleChunk("stdout", chunk))
      child.stderr.on("data", (chunk) => handleChunk("stderr", chunk))

      child.on("error", (error) => {
        clearTimeout(timeout)
        finished = true
        reject(error)
      })

      child.on("close", (code, signal) => {
        clearTimeout(timeout)
        finished = true
        resolve({
          code,
          signal,
          stdout,
          stderr,
          timedOut,
          outputLimitExceeded,
        })
      })

      if (stdin !== undefined) {
        child.stdin.write(stdin)
      }
      child.stdin.end()
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

function buildTemplateContext(
  plan: CasePlan,
  params: ExternalGeneratorParams,
  runtimeContext: TestdataGenerationRuntimeContext,
  extra?: Record<string, unknown>,
) {
  return {
    ordinal: plan.ordinal,
    groupKey: plan.groupKey,
    groupTitle: plan.groupTitle,
    score: plan.score,
    isSample: plan.isSample,
    isPretest: plan.isPretest,
    visible: plan.visible,
    caseType: plan.caseType,
    subtaskId: plan.subtaskId,
    groupId: plan.groupId,
    orderIndex: plan.orderIndex,
    caseSeed: plan.caseSeed,
    plan,
    problem: runtimeContext.problem,
    standardSolution: runtimeContext.standardSolution,
    external: params.context ?? {},
    ...extra,
  } satisfies TemplateContext
}

function toRecord(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined
}

function parseGeneratedOutput(
  params: ExternalGeneratorParams,
  result: ExternalCommandResult,
): GeneratedCase {
  if ((params.outputMode ?? "text") === "text") {
    return {
      input: result.stdout,
      metadata: {
        driver: params.driver,
      },
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`external_generator_invalid_json:${error instanceof Error ? error.message : String(error)}`)
  }

  const input = getValueByPath(parsed, params.inputField ?? "input")
  if (typeof input !== "string") {
    throw new Error("external_generator_missing_input")
  }

  const metadata = toRecord(getValueByPath(parsed, params.metadataField ?? "metadata"))

  return {
    input,
    metadata: {
      driver: params.driver,
      ...(metadata ?? {}),
    },
  }
}

function formatCommandFailure(prefix: string, result: ExternalCommandResult) {
  const reason = result.timedOut
    ? "timed_out"
    : result.outputLimitExceeded
      ? "output_limit_exceeded"
      : result.signal
        ? `signal_${result.signal}`
        : `exit_${result.code ?? "unknown"}`

  return [
    prefix,
    reason,
    result.stderr.trim() || undefined,
    result.stdout.trim() || undefined,
  ]
    .filter(Boolean)
    .join(": ")
}

export async function generateExternalPlannedCase(
  plan: CasePlan,
  params: ExternalGeneratorParams,
  runtimeContext: TestdataGenerationRuntimeContext,
): Promise<GeneratedCase> {
  const payload = {
    driver: params.driver,
    plan,
    problem: runtimeContext.problem ?? null,
    standardSolution: runtimeContext.standardSolution ?? null,
    context: params.context ?? {},
  }
  const templateContext = buildTemplateContext(plan, params, runtimeContext)
  const generateResult = await runExternalCommand(params, templateContext, payload)

  if (
    generateResult.timedOut ||
    generateResult.outputLimitExceeded ||
    generateResult.signal ||
    generateResult.code !== 0
  ) {
    throw new Error(formatCommandFailure("external_generator_failed", generateResult))
  }

  const generated = parseGeneratedOutput(params, generateResult)

  if (params.validator) {
    const validatorContext = buildTemplateContext(plan, params, runtimeContext, {
      generatedInput: generated.input,
    })
    const validationResult = await runExternalCommand(
      {
        ...params.validator,
        cwd: params.validator.cwd ?? params.cwd,
      },
      validatorContext,
      {
        ...payload,
        generatedInput: generated.input,
      },
      generated.input,
    )
    if (
      validationResult.timedOut ||
      validationResult.outputLimitExceeded ||
      validationResult.signal ||
      validationResult.code !== 0
    ) {
      throw new Error(formatCommandFailure("external_validator_failed", validationResult))
    }
  }

  return generated
}
