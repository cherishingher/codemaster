import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { spawn } from "child_process"
import { isSandboxAvailable, runInSandbox, compileInSandbox, type SandboxResult } from "@/lib/sandbox"

export const runtime = "nodejs"

const MAX_CODE_BYTES = 64 * 1024
const MAX_INPUT_BYTES = 256 * 1024
const MAX_OUTPUT_BYTES = 256 * 1024
const COMPILE_TIMEOUT_MS = 8000
const RUN_TIMEOUT_MS = 4000
const BITS_HEADER = `#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
#include <cmath>
#include <numeric>
#include <queue>
#include <stack>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
`

type RunResult = {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  durationMs: number
}

const RLIMIT_CPU_SEC = 10
const RLIMIT_FSIZE_KB = 32768
const RLIMIT_AS_KB = 524288
const RLIMIT_NPROC = 32

function runCommand(
  cmd: string,
  args: string[],
  options: { cwd: string; input?: string; timeoutMs: number; sandbox?: boolean }
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let child
    if (options.sandbox !== false) {
      const limits = [
        `ulimit -t ${RLIMIT_CPU_SEC}`,
        `ulimit -f ${RLIMIT_FSIZE_KB}`,
        `ulimit -v ${RLIMIT_AS_KB}`,
        `ulimit -u ${RLIMIT_NPROC}`,
      ].join(" && ")
      const escapedArgs = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")
      child = spawn("sh", ["-c", `${limits} && exec ${cmd} ${escapedArgs}`], {
        cwd: options.cwd,
        env: { ...process.env, HOME: "/tmp", LANG: "C.UTF-8" },
      })
    } else {
      child = spawn(cmd, args, { cwd: options.cwd })
    }
    let stdout = ""
    let stderr = ""
    let timedOut = false

    const killTimer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, options.timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
        stdout = stdout.slice(0, MAX_OUTPUT_BYTES)
      }
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
        stderr = stderr.slice(0, MAX_OUTPUT_BYTES)
      }
    })
    child.on("error", (err) => {
      clearTimeout(killTimer)
      reject(err)
    })
    child.on("close", (code) => {
      clearTimeout(killTimer)
      resolve({
        stdout,
        stderr,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - start,
      })
    })

    if (options.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()
  })
}

const handler = async (req: Request) => {
  if (process.env.ENABLE_LOCAL_RUNNER !== "true") {
    return NextResponse.json(
      { error: "local_runner_disabled", message: "本地运行功能已关闭" },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === "string" ? body.code : ""
  const language = typeof body.language === "string" ? body.language : ""
  const normalizedLanguage = language.trim().toLowerCase()
  const input = typeof body.input === "string" ? body.input : ""

  if (!code.trim()) {
    return NextResponse.json({ error: "code_required" }, { status: 400 })
  }
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return NextResponse.json({ error: "code_too_large" }, { status: 400 })
  }
  if (normalizedLanguage.startsWith("scratch") || normalizedLanguage === "sb3") {
    return NextResponse.json({ error: "scratch_run_not_supported" }, { status: 400 })
  }
  if (!["cpp11", "cpp14", "cpp17", "python"].includes(normalizedLanguage)) {
    return NextResponse.json({ error: "unsupported_language" }, { status: 400 })
  }
  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "input_too_large" }, { status: 400 })
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-run-"))
  let normalizedCode = code
  let warning: string | null = null
  if (normalizedCode.includes("bits/stdc++.h")) {
    normalizedCode = normalizedCode.replace(/#include\s*<bits\/stdc\+\+\.h>/g, BITS_HEADER.trim())
    warning = "已在本地运行中自动替换 <bits/stdc++.h> 为标准头文件"
  }

  const useDocker = isSandboxAvailable()

  try {
  if (normalizedLanguage.startsWith("cpp")) {
      const sourcePath = path.join(workDir, "main.cpp")
      const binPath = path.join(workDir, "main")
      await writeFile(sourcePath, normalizedCode, "utf8")

      const stdFlag =
        normalizedLanguage === "cpp11"
          ? "c++11"
          : normalizedLanguage === "cpp14"
          ? "c++14"
          : "c++17"

      let compileResult: RunResult | SandboxResult
      try {
        if (useDocker) {
          compileResult = await compileInSandbox({
            workDir,
            sourceName: "main.cpp",
            outputName: "main",
            compiler: "g++",
            compilerArgs: [`-std=${stdFlag}`, "-O2"],
            timeoutMs: COMPILE_TIMEOUT_MS,
          })
        } else {
          const preferredCompiler = process.env.CPP_COMPILER ?? "g++"
          try {
            compileResult = await runCommand(
              preferredCompiler,
              ["-std=" + stdFlag, "-O2", sourcePath, "-o", binPath],
              { cwd: workDir, timeoutMs: COMPILE_TIMEOUT_MS }
            )
          } catch (err) {
            if (preferredCompiler !== "clang++") {
              compileResult = await runCommand(
                "clang++",
                ["-std=" + stdFlag, "-O2", sourcePath, "-o", binPath],
                { cwd: workDir, timeoutMs: COMPILE_TIMEOUT_MS }
              )
            } else {
              throw err
            }
          }
        }
      } catch (err) {
        return NextResponse.json(
          { ok: false, phase: "compile", error: String(err) },
          { status: 500 }
        )
      }

      if (compileResult.exitCode !== 0) {
        return NextResponse.json({
          ok: false,
          phase: "compile",
          warning,
          ...compileResult,
        })
      }

      const runResult = useDocker
        ? await runInSandbox({
            workDir,
            command: "./main",
            input,
            timeoutMs: RUN_TIMEOUT_MS,
          })
        : await runCommand(binPath, [], {
            cwd: workDir,
            input,
            timeoutMs: RUN_TIMEOUT_MS,
            sandbox: true,
          })

      return NextResponse.json({
        ok: true,
        phase: "run",
        warning,
        sandbox: useDocker ? "docker" : "ulimit",
        ...runResult,
      })
    }

    const sourcePath = path.join(workDir, "main.py")
    await writeFile(sourcePath, normalizedCode, "utf8")
    const runResult = useDocker
      ? await runInSandbox({
          workDir,
          command: "python3",
          args: ["/sandbox/work/main.py"],
          input,
          timeoutMs: RUN_TIMEOUT_MS,
        })
      : await runCommand("python3", [sourcePath], {
          cwd: workDir,
          input,
          timeoutMs: RUN_TIMEOUT_MS,
          sandbox: true,
        })

    return NextResponse.json({
      ok: true,
      phase: "run",
      warning,
      sandbox: useDocker ? "docker" : "ulimit",
      ...runResult,
    })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export const POST = withAuth(handler, { roles: "admin" })
