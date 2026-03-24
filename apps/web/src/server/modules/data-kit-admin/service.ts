import * as fs from "node:fs/promises"
import * as path from "node:path"
import { spawn } from "node:child_process"
import type { DataKitToolDefinition } from "@/server/modules/data-kit-admin/shared"
import {
  DATA_KIT_DOCS,
  DATA_KIT_GENERATORS,
  DATA_KIT_VALIDATORS,
  DataKitError,
  getGeneratorById,
  getValidatorById,
} from "@/server/modules/data-kit-admin/shared"

type RunResult = {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
}

const MAX_OUTPUT_CHARS = 120_000
const TOOLKIT_ROOT_CANDIDATES = [
  process.env.OI_ICPC_DATA_KIT_ROOT,
  path.resolve(process.cwd(), "oi-icpc-data-kit"),
  path.resolve(process.cwd(), "..", "oi-icpc-data-kit"),
  path.resolve(process.cwd(), "..", "..", "oi-icpc-data-kit"),
  path.resolve(process.cwd(), "..", "..", "..", "oi-icpc-data-kit"),
  path.resolve(process.cwd(), "..", "..", "..", "..", "oi-icpc-data-kit"),
].filter(Boolean) as string[]

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function resolveToolkitRoot() {
  for (const candidate of TOOLKIT_ROOT_CANDIDATES) {
    const readmePath = path.join(candidate, "README.md")
    const templatesPath = path.join(candidate, "templates")
    if ((await pathExists(readmePath)) && (await pathExists(templatesPath))) {
      return candidate
    }
  }
  throw new DataKitError("toolkit_not_found", "未找到 oi-icpc-data-kit，请先确认工具箱目录存在。", 500)
}

async function ensureCompiledDir(rootPath: string) {
  const compiledDir = path.join(rootPath, ".compiled")
  await fs.mkdir(compiledDir, { recursive: true })
  return compiledDir
}

function trimOutput(stdout: string, stderr: string) {
  const mergedLength = stdout.length + stderr.length
  if (mergedLength <= MAX_OUTPUT_CHARS) {
    return { stdout, stderr, truncated: false }
  }

  const available = Math.max(10_000, Math.floor(MAX_OUTPUT_CHARS / 2))
  return {
    stdout: stdout.slice(0, available),
    stderr: stderr.slice(0, available),
    truncated: true,
  }
}

async function runProcess(
  command: string,
  args: string[],
  options?: { cwd?: string; input?: string; timeoutMs?: number },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: "pipe",
    })

    let stdout = ""
    let stderr = ""
    let finished = false

    const timeout = setTimeout(() => {
      if (!finished) {
        child.kill("SIGKILL")
      }
    }, options?.timeoutMs ?? 15_000)

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", (error) => {
      clearTimeout(timeout)
      finished = true
      reject(error)
    })

    child.on("close", (code) => {
      clearTimeout(timeout)
      finished = true
      const trimmed = trimOutput(stdout, stderr)
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout: trimmed.stdout,
        stderr: trimmed.stderr,
        truncated: trimmed.truncated,
      })
    })

    if (options?.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()
  })
}

async function resolveCompiler() {
  for (const compiler of ["g++", "c++"]) {
    try {
      const result = await runProcess(compiler, ["--version"], { timeoutMs: 5_000 })
      if (result.ok) {
        return compiler
      }
    } catch {
      continue
    }
  }
  throw new DataKitError("compiler_not_found", "未找到可用的 C++ 编译器（g++ / c++）。", 500)
}

async function ensureCompiledBinary(rootPath: string, tool: DataKitToolDefinition) {
  const compiler = await resolveCompiler()
  const compiledDir = await ensureCompiledDir(rootPath)
  const sourcePath = path.join(rootPath, "templates", tool.fileName)
  const binaryPath = path.join(compiledDir, tool.fileName.replace(/\.cpp$/, ""))

  const [sourceStat, binaryStat] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(binaryPath).catch(() => null),
  ])

  if (!binaryStat || binaryStat.mtimeMs < sourceStat.mtimeMs) {
    const compileResult = await runProcess(
      compiler,
      ["-std=c++17", "-O2", sourcePath, "-o", binaryPath],
      { cwd: rootPath, timeoutMs: 60_000 },
    )

    if (!compileResult.ok) {
      throw new DataKitError(
        "compile_failed",
        `编译 ${tool.fileName} 失败：${compileResult.stderr || compileResult.stdout || "unknown error"}`,
        500,
      )
    }
  }

  return { binaryPath, compiler }
}

function toToolArgs(params: Record<string, string>) {
  return Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
}

async function readMarkdownIfExists(rootPath: string, filePath: string) {
  try {
    return await fs.readFile(path.join(rootPath, filePath), "utf8")
  } catch {
    return null
  }
}

export async function getDataKitOverview() {
  const rootPath = await resolveToolkitRoot()
  const compiler = await resolveCompiler().catch(() => null)
  const docs = await Promise.all(
    DATA_KIT_DOCS.map(async (doc) => ({
      slug: doc.slug,
      title: doc.title,
      markdown: (await readMarkdownIfExists(rootPath, doc.filePath)) ?? `未找到 ${doc.filePath}`,
    })),
  )

  const examplesDir = path.join(rootPath, "examples")
  const exampleEntries = await fs.readdir(examplesDir, { withFileTypes: true }).catch(() => [])
  const examples = await Promise.all(
    exampleEntries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const readme = await readMarkdownIfExists(rootPath, path.join("examples", entry.name, "README.md"))
        return {
          id: entry.name,
          title: entry.name.replace(/[_-]/g, " "),
          markdown: readme ?? "暂无说明",
        }
      }),
  )

  return {
    rootPath,
    compiler,
    docs,
    generators: DATA_KIT_GENERATORS,
    validators: DATA_KIT_VALIDATORS,
    examples,
  }
}

export async function generateWithDataKit(toolId: string, params: Record<string, string>) {
  const rootPath = await resolveToolkitRoot()
  const tool = getGeneratorById(toolId)
  if (!tool) {
    throw new DataKitError("tool_not_found", "未找到对应的生成器模板。", 404)
  }

  const { binaryPath, compiler } = await ensureCompiledBinary(rootPath, tool)
  const result = await runProcess(binaryPath, toToolArgs(params), {
    cwd: rootPath,
    timeoutMs: 20_000,
  })

  return {
    tool: {
      id: tool.id,
      title: tool.title,
      fileName: tool.fileName,
    },
    compiler,
    params,
    command: [binaryPath, ...toToolArgs(params)].join(" "),
    ...result,
  }
}

export async function validateWithDataKit(toolId: string, params: Record<string, string>, input: string) {
  const rootPath = await resolveToolkitRoot()
  const tool = getValidatorById(toolId)
  if (!tool) {
    throw new DataKitError("tool_not_found", "未找到对应的校验器模板。", 404)
  }

  const { binaryPath, compiler } = await ensureCompiledBinary(rootPath, tool)
  const result = await runProcess(binaryPath, toToolArgs(params), {
    cwd: rootPath,
    input,
    timeoutMs: 20_000,
  })

  return {
    tool: {
      id: tool.id,
      title: tool.title,
      fileName: tool.fileName,
    },
    compiler,
    params,
    command: [binaryPath, ...toToolArgs(params)].join(" "),
    valid: result.ok,
    ...result,
  }
}

export async function runDataKitSelfTest() {
  const rootPath = await resolveToolkitRoot()
  const result = await runProcess("bash", [path.join(rootPath, "scripts", "self_test.sh")], {
    cwd: rootPath,
    timeoutMs: 180_000,
  })

  return {
    rootPath,
    command: `bash ${path.join(rootPath, "scripts", "self_test.sh")}`,
    ...result,
  }
}
