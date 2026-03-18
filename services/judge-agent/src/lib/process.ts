import { readFile } from "fs/promises"
import { spawn } from "child_process"

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string
    input?: string
    timeoutMs: number
    maxOutputBytes?: number
  }
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; timedOut: boolean; killed: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let killed = false
    const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024

    if (options.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()

    function enforceOutputLimit() {
      const totalBytes = Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(stderr, "utf8")
      if (totalBytes > maxOutputBytes && !killed) {
        killed = true
        child.kill("SIGKILL")
      }
    }

    child.stdout.on("data", (data) => {
      stdout += data.toString()
      enforceOutputLimit()
    })
    child.stderr.on("data", (data) => {
      stderr += data.toString()
      enforceOutputLimit()
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, options.timeoutMs)

    child.on("close", (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr, timedOut, killed })
    })
  })
}

export function normalizeOutput(value: string) {
  return value.trim().replace(/\r\n/g, "\n")
}

export async function readTextUri(uri: string) {
  if (!uri.startsWith("file://")) {
    throw new Error("unsupported_file_uri")
  }
  return readFile(uri.replace("file://", ""), "utf8")
}

export async function loadCode(code?: string, codeUri?: string) {
  if (code) return code
  if (codeUri?.startsWith("file://")) {
    return readFile(codeUri.replace("file://", ""), "utf8")
  }
  throw new Error("code_missing")
}
