import Redis from "ioredis";
import { z } from "zod";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";

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

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    input?: string;
    timeoutMs: number;
  }
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
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

async function loadCode(job: z.infer<typeof JobSchema>) {
  if (job.code) return job.code;
  if (job.codeUri?.startsWith("file://")) {
    const filepath = job.codeUri.replace("file://", "");
    return readFile(filepath, "utf8");
  }
  throw new Error("code is missing or codeUri unsupported");
}

async function readInput(uri: string) {
  if (!uri.startsWith("file://")) {
    throw new Error("only file:// testcases supported in judge-agent");
  }
  return readFile(uri.replace("file://", ""), "utf8");
}

async function handleJob(payload: unknown) {
  const job = JobSchema.parse(payload);
  const code = await loadCode(job);

  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-judge-"));
  const sourcePath = path.join(workDir, "main.cpp");
  const binPath = path.join(workDir, "main.out");

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
    const compile = await runCommand(
      "g++",
      ["-O2", `-std=${std}`, sourcePath, "-o", binPath],
      {
        cwd: workDir,
        timeoutMs: 10000,
      }
    );

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
    const result = isCpp
      ? await runCommand(binPath, [], {
          cwd: workDir,
          input,
          timeoutMs: timeLimit,
        })
      : await runCommand("python3", [sourcePath], {
          cwd: workDir,
          input,
          timeoutMs: timeLimit,
        });
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
}

async function main() {
  await ensureGroup();

  while (true) {
    const res = await redis.xreadgroup(
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
    );

    if (!res) continue;
    const [, messages] = res[0];

    for (const [id, fields] of messages) {
      try {
        const payloadIndex = fields.findIndex((v) => v === "payload");
        const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : "{}";
        const payload = JSON.parse(payloadRaw);
        await handleJob(payload);
        await redis.xack("judge:jobs", GROUP, id);
      } catch (err) {
        // TODO: 记录错误与重试策略
        console.error("job failed", err);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
