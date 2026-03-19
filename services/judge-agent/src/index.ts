import { Redis } from "ioredis";
import { z } from "zod";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "codemaster-sandbox";
const SANDBOX_MEMORY = process.env.SANDBOX_MEMORY ?? "256m";
const SANDBOX_CPUS = process.env.SANDBOX_CPUS ?? "1";
const SANDBOX_PIDS = process.env.SANDBOX_PIDS ?? "32";
const SANDBOX_TMPFS_SIZE = process.env.SANDBOX_TMPFS_SIZE ?? "32m";
const USE_DOCKER_SANDBOX = process.env.ENABLE_DOCKER_SANDBOX === "true";

type SandboxResult = { code: number | null; stdout: string; stderr: string; timedOut: boolean };

function runInDocker(
  workDir: string,
  cmd: string,
  options: { input?: string; timeoutMs: number; memoryMb?: number }
): Promise<SandboxResult> {
  const memLimit = options.memoryMb ? `${options.memoryMb}m` : SANDBOX_MEMORY;
  const dockerArgs = [
    "run", "--rm",
    "--network", "none",
    "--memory", memLimit,
    "--cpus", SANDBOX_CPUS,
    "--pids-limit", SANDBOX_PIDS,
    "--read-only",
    "--tmpfs", `/sandbox/work:size=${SANDBOX_TMPFS_SIZE},exec`,
    "--tmpfs", "/tmp:size=8m",
    "-v", `${path.resolve(workDir)}:/sandbox/input:ro`,
    "-w", "/sandbox/work",
    SANDBOX_IMAGE,
    "sh", "-c", `cp -r /sandbox/input/* /sandbox/work/ 2>/dev/null; ${cmd}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    if (options.input) child.stdin.write(options.input);
    child.stdin.end();

    child.stdout.on("data", (d) => {
      if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) stderr += d.toString();
    });

    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, options.timeoutMs + 2000);

    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!timedOut && code === 137) timedOut = true;
      resolve({ code: timedOut ? null : code, stdout, stderr, timedOut });
    });
  });
}

function compileInDocker(
  workDir: string,
  sourceName: string,
  outputName: string,
  compiler: string,
  compilerArgs: string[],
  timeoutMs: number
): Promise<SandboxResult> {
  const argsStr = compilerArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
  const cmd = `cp -r /sandbox/input/* /sandbox/work/ 2>/dev/null; ${compiler} ${argsStr} /sandbox/work/${sourceName} -o /sandbox/work/${outputName} && cp /sandbox/work/${outputName} /sandbox/input/${outputName}`;
  const dockerArgs = [
    "run", "--rm",
    "--network", "none",
    "--memory", SANDBOX_MEMORY,
    "--cpus", SANDBOX_CPUS,
    "--read-only",
    "--tmpfs", `/sandbox/work:size=${SANDBOX_TMPFS_SIZE},exec`,
    "--tmpfs", "/tmp:size=8m",
    "-v", `${path.resolve(workDir)}:/sandbox/input`,
    "-w", "/sandbox/work",
    SANDBOX_IMAGE,
    "sh", "-c", cmd,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdin.end();
    child.stdout.on("data", (d) => { if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) stdout += d.toString(); });
    child.stderr.on("data", (d) => { if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) stderr += d.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs + 2000);
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
  });
}

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  JUDGE_CALLBACK_SECRET: z.string().min(1),
  JUDGE_ID: z.string().optional(),
});

const env = envSchema.parse(process.env);
const redis = new Redis(env.REDIS_URL);

const GROUP = "judge-agents";
const CONSUMER = env.JUDGE_ID ?? `judge-${Math.random().toString(36).slice(2, 8)}`;

const JobSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  problemId: z.string(),
  problemVersionId: z.string().optional(),
  language: z.string(),
  code: z.string().optional(),
  codeUri: z.string().optional(),
  timeLimitMs: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
  testcases: z
    .array(
      z.object({
        testcaseId: z.string().optional(),
        inputUri: z.string(),
        outputUri: z.string(),
        score: z.number().int().min(0),
      })
    )
    .optional(),
});

async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", "judge:jobs", GROUP, "$", "MKSTREAM");
  } catch (err: any) {
    if (!String(err?.message ?? "").includes("BUSYGROUP")) {
      throw err;
    }
  }
}

type CaseResult = {
  testcaseId?: string;
  status: string;
  timeMs: number;
  memoryMb: number;
  score: number;
};

async function reportResult(
  submissionId: string,
  status: string,
  score: number,
  cases: CaseResult[]
) {
  const res = await fetch(`${env.API_BASE_URL}/api/judge/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-judge-secret": env.JUDGE_CALLBACK_SECRET,
    },
    body: JSON.stringify({
      submissionId,
      status,
      score,
      cases,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`callback failed: ${res.status} ${text}`);
  }
}

const MAX_OUTPUT_BYTES = 256 * 1024;
const RLIMIT_CPU_SEC = 15;
const RLIMIT_FSIZE_KB = 32768;
const RLIMIT_AS_KB = 524288;
const RLIMIT_NPROC = 32;

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    input?: string;
    timeoutMs: number;
    sandbox?: boolean;
  }
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    let child;
    if (options.sandbox !== false) {
      const limits = [
        `ulimit -t ${RLIMIT_CPU_SEC}`,
        `ulimit -f ${RLIMIT_FSIZE_KB}`,
        `ulimit -v ${RLIMIT_AS_KB}`,
        `ulimit -u ${RLIMIT_NPROC}`,
      ].join(" && ");
      const escapedArgs = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
      child = spawn("sh", ["-c", `${limits} && exec ${command} ${escapedArgs}`], {
        cwd: options.cwd,
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: "/tmp", LANG: "C.UTF-8" },
      });
    } else {
      child = spawn(command, args, { cwd: options.cwd });
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    child.stdout.on("data", (d) => {
      if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) {
        stdout += d.toString();
      }
    });
    child.stderr.on("data", (d) => {
      if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) {
        stderr += d.toString();
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function normalizeOutput(out: string) {
  return out.trim().replace(/\r\n/g, "\n");
}

const ALLOWED_DATA_DIRS = [
  process.env.HUSTOJ_DATA_DIR ?? "/home/judge/data",
  process.env.LOCAL_STORAGE_DIR ?? "/tmp",
];

function assertSafePath(filepath: string) {
  const resolved = path.resolve(filepath);
  const isSafe = ALLOWED_DATA_DIRS.some((dir) => resolved.startsWith(path.resolve(dir)));
  if (!isSafe) {
    throw new Error(`path outside allowed directories: ${resolved}`);
  }
  if (resolved.includes("\0")) {
    throw new Error("null byte in path");
  }
  return resolved;
}

async function loadCode(job: z.infer<typeof JobSchema>) {
  if (job.code) return job.code;
  if (job.codeUri?.startsWith("file://")) {
    const filepath = assertSafePath(job.codeUri.replace("file://", ""));
    return readFile(filepath, "utf8");
  }
  throw new Error("code is missing or codeUri unsupported");
}

async function readInput(uri: string) {
  if (!uri.startsWith("file://")) {
    throw new Error("only file:// testcases supported in judge-agent");
  }
  const filepath = assertSafePath(uri.replace("file://", ""));
  return readFile(filepath, "utf8");
}

async function handleJob(payload: unknown) {
  const job = JobSchema.parse(payload);
  const code = await loadCode(job);

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-judge-"));
  const sourcePath = path.join(workDir, "main.cpp");
  const binPath = path.join(workDir, "main.out");

  try {
    const timeLimit = job.timeLimitMs ?? 1000;
    const testcases = job.testcases ?? [];
    const cases: CaseResult[] = [];

    const cppStdMap: Record<string, string> = {
      cpp11: "c++11",
      cpp14: "c++14",
      cpp17: "c++17",
    };

    const isCpp = Object.prototype.hasOwnProperty.call(cppStdMap, job.language);
    const isPython = job.language === "python";

    await writeFile(sourcePath, code, "utf8");

    if (isCpp) {
      const std = cppStdMap[job.language];
      const compile = USE_DOCKER_SANDBOX
        ? await compileInDocker(workDir, "main.cpp", "main.out", "g++", ["-O2", `-std=${std}`], 10000)
        : await runCommand("g++", ["-O2", `-std=${std}`, sourcePath, "-o", binPath], { cwd: workDir, timeoutMs: 10000, sandbox: false });

      if (compile.timedOut || compile.code !== 0) {
        await reportResult(job.submissionId, "COMPILE_ERROR", 0, []);
        return;
      }
    } else if (!isPython) {
      await reportResult(job.submissionId, "SYSTEM_ERROR", 0, []);
      return;
    }

    let totalScore = 0;
    for (const tc of testcases) {
      const input = await readInput(tc.inputUri);
      const expected = await readInput(tc.outputUri);
      const start = Date.now();
      let result;
      if (USE_DOCKER_SANDBOX) {
        const cmd = isCpp ? "./main.out" : "python3 /sandbox/work/main.cpp";
        result = await runInDocker(workDir, cmd, { input, timeoutMs: timeLimit, memoryMb: job.memoryLimitMb });
      } else {
        result = isCpp
          ? await runCommand(binPath, [], { cwd: workDir, input, timeoutMs: timeLimit, sandbox: true })
          : await runCommand("python3", [sourcePath], { cwd: workDir, input, timeoutMs: timeLimit, sandbox: true });
      }
      const timeMs = Date.now() - start;

      if (result.timedOut) {
        cases.push({
          testcaseId: tc.testcaseId,
          status: "TIME_LIMIT_EXCEEDED",
          timeMs,
          memoryMb: 0,
          score: 0,
        });
        continue;
      }

      if (result.code !== 0) {
        cases.push({
          testcaseId: tc.testcaseId,
          status: "RUNTIME_ERROR",
          timeMs,
          memoryMb: 0,
          score: 0,
        });
        continue;
      }

      const ok = normalizeOutput(result.stdout) === normalizeOutput(expected);
      cases.push({
        testcaseId: tc.testcaseId,
        status: ok ? "ACCEPTED" : "WRONG_ANSWER",
        timeMs,
        memoryMb: 0,
        score: ok ? tc.score : 0,
      });
      totalScore += ok ? tc.score : 0;
    }

    const finalStatus = cases.some((c) => c.status !== "ACCEPTED")
      ? cases.find((c) => c.status === "TIME_LIMIT_EXCEEDED")
        ? "TIME_LIMIT_EXCEEDED"
        : cases.find((c) => c.status === "RUNTIME_ERROR")
          ? "RUNTIME_ERROR"
          : "WRONG_ANSWER"
      : "ACCEPTED";

    await reportResult(job.submissionId, finalStatus, totalScore, cases);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function main() {
  await ensureGroup();

  while (true) {
    const res = (await (redis as any).xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "BLOCK",
      "2000",
      "COUNT",
      "1",
      "STREAMS",
      "judge:jobs",
      ">"
    )) as [string, [string, string[]][]][] | null;

    if (!res) continue;
    const [, messages] = res[0];

    for (const [id, fields] of messages) {
      const payloadIndex = fields.findIndex((v: string) => v === "payload");
      const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : "{}";
      let payload: unknown = {};
      let submissionId: string | null = null;

      try {
        payload = JSON.parse(payloadRaw);
        if (
          payload &&
          typeof payload === "object" &&
          "submissionId" in payload &&
          typeof (payload as { submissionId?: unknown }).submissionId === "string"
        ) {
          submissionId = (payload as { submissionId: string }).submissionId;
        }

        await handleJob(payload);
      } catch (err) {
        console.error("job failed", err);
        if (submissionId) {
          try {
            await reportResult(submissionId, "SYSTEM_ERROR", 0, []);
          } catch (reportErr) {
            console.error("report system error failed", reportErr);
          }
        }
      } finally {
        try {
          await redis.xack("judge:jobs", GROUP, id);
        } catch (ackErr) {
          console.error("xack failed", ackErr);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
