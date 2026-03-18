import { chmod } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { z } from "zod"
import { runCommand } from "./process.js"

type RunResult = Awaited<ReturnType<typeof runCommand>>

const envSchema = z.object({
  TESTDATA_RUNNER_MODE: z.enum(["host", "docker"]).optional(),
  TESTDATA_RUNNER_IMAGE: z.string().min(1).optional(),
  TESTDATA_RUNNER_DOCKER_BIN: z.string().min(1).optional(),
  TESTDATA_RUNNER_COMPILE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  TESTDATA_RUNNER_CPUS: z.coerce.number().positive().optional(),
  TESTDATA_RUNNER_MEMORY_MB: z.coerce.number().int().positive().optional(),
  TESTDATA_RUNNER_PIDS_LIMIT: z.coerce.number().int().positive().optional(),
  TESTDATA_RUNNER_OUTPUT_LIMIT_BYTES: z.coerce.number().int().positive().optional(),
})

const runnerEnv = envSchema.parse(process.env)

type RunnerLanguage = "cpp11" | "cpp14" | "cpp17" | "python"

type RunnerOptions = {
  language: RunnerLanguage
  workDir: string
  sourcePath: string
  binPath: string
  timeoutMs: number
  input?: string
}

function getRunnerMode() {
  return runnerEnv.TESTDATA_RUNNER_MODE ?? "host"
}

function dockerBinary() {
  return runnerEnv.TESTDATA_RUNNER_DOCKER_BIN ?? "docker"
}

function dockerImage() {
  return runnerEnv.TESTDATA_RUNNER_IMAGE ?? "codemaster-testdata-runner:latest"
}

function outputLimitBytes() {
  return runnerEnv.TESTDATA_RUNNER_OUTPUT_LIMIT_BYTES ?? 1024 * 1024
}

function compileTimeoutMs() {
  return runnerEnv.TESTDATA_RUNNER_COMPILE_TIMEOUT_MS ?? 10000
}

function containerPathForHostFile(hostFilePath: string) {
  return path.posix.join("/job", path.basename(hostFilePath))
}

function buildDockerArgs(options: {
  workDir: string
  containerName: string
  interactive: boolean
  command: string[]
}) {
  return [
    "run",
    "--rm",
    "--name",
    options.containerName,
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    ...(options.interactive ? ["-i"] : []),
    "--user",
    "10001:10001",
    "--pids-limit",
    String(runnerEnv.TESTDATA_RUNNER_PIDS_LIMIT ?? 64),
    "--cpus",
    String(runnerEnv.TESTDATA_RUNNER_CPUS ?? 1),
    "--memory",
    `${runnerEnv.TESTDATA_RUNNER_MEMORY_MB ?? 512}m`,
    "--memory-swap",
    `${runnerEnv.TESTDATA_RUNNER_MEMORY_MB ?? 512}m`,
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=128m",
    "--tmpfs",
    "/run:rw,nosuid,nodev,size=16m",
    "--volume",
    `${options.workDir}:/job`,
    "--workdir",
    "/job",
    dockerImage(),
    ...options.command,
  ]
}

async function runDockerProcess(options: {
  workDir: string
  timeoutMs: number
  input?: string
  command: string[]
}) {
  const containerName = `codemaster-testgen-${randomUUID().slice(0, 8)}`
  const args = buildDockerArgs({
    workDir: options.workDir,
    containerName,
    interactive: typeof options.input === "string",
    command: options.command,
  })

  try {
    return await runCommand(dockerBinary(), args, {
      cwd: options.workDir,
      input: options.input,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: outputLimitBytes(),
    })
  } finally {
    await runCommand(dockerBinary(), ["rm", "-f", containerName], {
      cwd: options.workDir,
      timeoutMs: 3000,
      maxOutputBytes: 64 * 1024,
    }).catch(() => undefined)
  }
}

async function compileInHost(options: RunnerOptions): Promise<RunResult> {
  const cppStdMap: Record<Exclude<RunnerLanguage, "python">, string> = {
    cpp11: "c++11",
    cpp14: "c++14",
    cpp17: "c++17",
  }

  if (options.language === "python") {
    return runCommand("python3", ["-m", "py_compile", options.sourcePath], {
      cwd: options.workDir,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: 256 * 1024,
    })
  }

  return runCommand(
    "g++",
    ["-O2", `-std=${cppStdMap[options.language]}`, options.sourcePath, "-o", options.binPath],
    {
      cwd: options.workDir,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: 256 * 1024,
    }
  )
}

async function compileInDocker(options: RunnerOptions): Promise<RunResult> {
  const containerSource = containerPathForHostFile(options.sourcePath)
  const containerBin = containerPathForHostFile(options.binPath)

  if (options.language === "python") {
    return runDockerProcess({
      workDir: options.workDir,
      timeoutMs: options.timeoutMs,
      command: ["sh", "-lc", `python3 -m py_compile ${containerSource}`],
    })
  }

  const cppStdMap: Record<Exclude<RunnerLanguage, "python">, string> = {
    cpp11: "c++11",
    cpp14: "c++14",
    cpp17: "c++17",
  }

  return runDockerProcess({
    workDir: options.workDir,
    timeoutMs: options.timeoutMs,
    command: [
      "sh",
      "-lc",
      `g++ -O2 -std=${cppStdMap[options.language]} ${containerSource} -o ${containerBin}`,
    ],
  })
}

async function executeInHost(options: RunnerOptions): Promise<RunResult> {
  if (options.language === "python") {
    return runCommand("python3", [options.sourcePath], {
      cwd: options.workDir,
      input: options.input,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: outputLimitBytes(),
    })
  }

  return runCommand(options.binPath, [], {
    cwd: options.workDir,
    input: options.input,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: outputLimitBytes(),
  })
}

async function executeInDocker(options: RunnerOptions): Promise<RunResult> {
  const containerSource = containerPathForHostFile(options.sourcePath)
  const containerBin = containerPathForHostFile(options.binPath)
  const command =
    options.language === "python"
      ? `python3 ${containerSource}`
      : containerBin

  return runDockerProcess({
    workDir: options.workDir,
    timeoutMs: options.timeoutMs,
    input: options.input,
    command: ["sh", "-lc", command],
  })
}

export async function prepareRunnerWorkdir(workDir: string) {
  if (getRunnerMode() === "docker") {
    // Docker runs as an unprivileged container user in the hardening phase.
    // Make the ephemeral job directory writable before bind-mounting it.
    await chmod(workDir, 0o777)
  }
}

export async function compileStandardSolution(options: RunnerOptions) {
  const compileOptions = {
    ...options,
    timeoutMs: options.timeoutMs || compileTimeoutMs(),
  }
  return getRunnerMode() === "docker"
    ? compileInDocker(compileOptions)
    : compileInHost(compileOptions)
}

export async function executeStandardSolution(options: RunnerOptions) {
  return getRunnerMode() === "docker"
    ? executeInDocker(options)
    : executeInHost(options)
}

export function getTestdataRunnerMode() {
  return getRunnerMode()
}
