import { spawn } from "child_process";
import path from "path";

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "codemaster-sandbox";
const SANDBOX_MEMORY = process.env.SANDBOX_MEMORY ?? "256m";
const SANDBOX_CPUS = process.env.SANDBOX_CPUS ?? "1";
const SANDBOX_PIDS = process.env.SANDBOX_PIDS ?? "32";
const SANDBOX_TMPFS_SIZE = process.env.SANDBOX_TMPFS_SIZE ?? "32m";
const MAX_OUTPUT_BYTES = 256 * 1024;

export type SandboxResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
};

export function isSandboxAvailable(): boolean {
  return process.env.ENABLE_DOCKER_SANDBOX === "true";
}

export function runInSandbox(options: {
  workDir: string;
  command: string;
  args?: string[];
  input?: string;
  timeoutMs: number;
  memoryMb?: number;
}): Promise<SandboxResult> {
  const memLimit = options.memoryMb
    ? `${options.memoryMb}m`
    : SANDBOX_MEMORY;

  const dockerArgs = [
    "run", "--rm",
    "--network", "none",
    "--memory", memLimit,
    "--cpus", SANDBOX_CPUS,
    "--pids-limit", SANDBOX_PIDS,
    "--read-only",
    "--tmpfs", `/sandbox/work:size=${SANDBOX_TMPFS_SIZE},exec`,
    "--tmpfs", "/tmp:size=8m",
    "-v", `${path.resolve(options.workDir)}:/sandbox/input:ro`,
    "-w", "/sandbox/work",
    SANDBOX_IMAGE,
    "sh", "-c",
    `cp -r /sandbox/input/* /sandbox/work/ 2>/dev/null; ${options.command} ${(options.args ?? []).map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`,
  ];

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn("docker", dockerArgs);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs + 2000);

    child.stdout.on("data", (chunk) => {
      if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString();
      }
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString();
      }
    });
    child.on("error", (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      const exitCode = timedOut ? null : code;
      if (!timedOut && code === 137) {
        timedOut = true;
      }
      resolve({
        stdout,
        stderr,
        exitCode,
        timedOut,
        durationMs: Date.now() - start,
      });
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

export async function compileInSandbox(options: {
  workDir: string;
  sourceName: string;
  outputName: string;
  compiler: string;
  compilerArgs: string[];
  timeoutMs: number;
}): Promise<SandboxResult> {
  const cmd = [
    `cp -r /sandbox/input/* /sandbox/work/ 2>/dev/null;`,
    options.compiler,
    ...options.compilerArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`),
    `/sandbox/work/${options.sourceName}`,
    "-o", `/sandbox/work/${options.outputName}`,
    `&& cp /sandbox/work/${options.outputName} /sandbox/input/${options.outputName}`,
  ].join(" ");

  const dockerArgs = [
    "run", "--rm",
    "--network", "none",
    "--memory", SANDBOX_MEMORY,
    "--cpus", SANDBOX_CPUS,
    "--read-only",
    "--tmpfs", `/sandbox/work:size=${SANDBOX_TMPFS_SIZE},exec`,
    "--tmpfs", "/tmp:size=8m",
    "-v", `${path.resolve(options.workDir)}:/sandbox/input`,
    "-w", "/sandbox/work",
    SANDBOX_IMAGE,
    "sh", "-c", cmd,
  ];

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn("docker", dockerArgs);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs + 2000);

    child.stdout.on("data", (chunk) => {
      if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) stderr += chunk.toString();
    });
    child.on("error", (err) => { clearTimeout(killTimer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({ stdout, stderr, exitCode: code, timedOut, durationMs: Date.now() - start });
    });

    child.stdin.end();
  });
}
