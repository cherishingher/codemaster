import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { readFile, mkdir, writeFile } from "fs/promises";
import path from "path";

type HustojConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  dataDir: string;
};

const DEFAULT_LANG_MAP: Record<string, number> = {
  cpp11: 1,
  cpp14: 1,
  cpp17: 1,
  "c++11": 1,
  "c++14": 1,
  "c++17": 1,
  python: 6,
  py: 6,
};

const HUSTOJ_USER_ID_MAX = 20;
const HUSTOJ_NICK_MAX = 20;

function normalizeHustojUserId(id: string) {
  if (id.length <= HUSTOJ_USER_ID_MAX) return id;
  return id.slice(-HUSTOJ_USER_ID_MAX);
}

function normalizeHustojNick(raw: string) {
  if (raw.length <= HUSTOJ_NICK_MAX) return raw;
  return raw.slice(0, HUSTOJ_NICK_MAX);
}

function getConfig(): HustojConfig {
  const host = process.env.HUSTOJ_MYSQL_HOST ?? "127.0.0.1";
  const port = Number(process.env.HUSTOJ_MYSQL_PORT ?? 3306);
  const user = process.env.HUSTOJ_MYSQL_USER ?? "root";
  const password = process.env.HUSTOJ_MYSQL_PASSWORD ?? "root";
  const database = process.env.HUSTOJ_MYSQL_DB ?? "jol";
  const dataDir = process.env.HUSTOJ_DATA_DIR ?? "/home/judge/data";
  return { host, port, user, password, database, dataDir };
}

let pool: mysql.Pool | null = null;

function getPool() {
  if (!pool) {
    const cfg = getConfig();
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectionLimit: 5,
      charset: "utf8mb4",
      ssl: process.env.HUSTOJ_MYSQL_SSL === "true"
        ? { rejectUnauthorized: process.env.HUSTOJ_MYSQL_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
    });
  }
  return pool;
}

function toFilePath(uri: string) {
  let raw: string;
  if (uri.startsWith("file://")) {
    try {
      raw = decodeURIComponent(new URL(uri).pathname);
    } catch {
      raw = uri.replace("file://", "");
    }
  } else {
    raw = uri;
  }
  const resolved = path.resolve(raw);
  if (resolved.includes("\0")) {
    throw new Error("null byte in file path");
  }
  const storageDir = path.resolve(process.env.LOCAL_STORAGE_DIR ?? "./apps/web/storage");
  const dataDir = path.resolve(getConfig().dataDir);
  if (!resolved.startsWith(storageDir) && !resolved.startsWith(dataDir)) {
    throw new Error(`file path outside allowed directories: ${resolved}`);
  }
  return resolved;
}

function getFirstSampleIO(samples: unknown) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { input: "", output: "" };
  }
  const first = samples[0];
  if (!first || typeof first !== "object") {
    return { input: "", output: "" };
  }
  const sample = first as { input?: unknown; output?: unknown };
  return {
    input: typeof sample.input === "string" ? sample.input : "",
    output: typeof sample.output === "string" ? sample.output : "",
  };
}

export function mapLanguageToHustoj(lang: string) {
  const map = DEFAULT_LANG_MAP;
  const key = lang.toLowerCase();
  const value = map[key];
  if (value === undefined) {
    throw new Error(`unsupported_language:${lang}`);
  }
  return value;
}

export async function ensureHustojUser(user: { id: string; email: string | null; name: string | null }) {
  const pool = getPool();
  const email = user.email ?? "";
  const nick = normalizeHustojNick(user.name ?? user.email ?? user.id);
  const hustojUserId = normalizeHustojUserId(user.id);
  await pool.query(
    "INSERT INTO users (user_id, email, nick, reg_time) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE email=VALUES(email), nick=VALUES(nick)",
    [hustojUserId, email, nick]
  );
  return { hustojUserId, nick };
}

async function writeHustojData(problemId: number, testcases: { inputUri: string; outputUri: string; orderIndex: number | null }[]) {
  const cfg = getConfig();
  const dir = path.join(cfg.dataDir, String(problemId));
  await mkdir(dir, { recursive: true });
  const sorted = [...testcases].sort((a, b) => {
    const ao = a.orderIndex ?? 0;
    const bo = b.orderIndex ?? 0;
    if (ao === bo) return 0;
    return ao - bo;
  });
  let idx = 1;
  for (const tc of sorted) {
    const inputPath = toFilePath(tc.inputUri);
    const outputPath = toFilePath(tc.outputUri);
    const input = await readFile(inputPath, "utf8");
    const output = await readFile(outputPath, "utf8");
    await writeFile(path.join(dir, `${idx}.in`), input, "utf8");
    await writeFile(path.join(dir, `${idx}.out`), output, "utf8");
    idx += 1;
  }
}

export async function ensureHustojProblem(problemId: string) {
  const mapping = await db.hustojProblemMap.findUnique({
    where: { problemId },
  });
  if (mapping) {
    return mapping.hustojProblemId;
  }

  const problem = await db.problem.findUnique({
    where: { id: problemId },
    include: {
      currentVersion: {
        include: { testcases: true },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { testcases: true },
      },
    },
  });
  const version = problem?.currentVersion ?? problem?.versions[0];
  if (!problem || !version) {
    throw new Error("problem_not_found");
  }

  const { input: sampleInput, output: sampleOutput } = getFirstSampleIO(version.samples);
  const timeLimitSec = Math.max(1, Math.round(version.timeLimitMs / 1000));

  const pool = getPool();
  const [result] = await pool.query<mysql.ResultSetHeader>(
    "INSERT INTO problem (title, description, input, output, sample_input, sample_output, hint, source, in_date, time_limit, memory_limit, defunct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'N')",
    [
      problem.title,
      version.statementMd ?? version.statement ?? "",
      version.inputFormat ?? "",
      version.outputFormat ?? "",
      sampleInput,
      sampleOutput,
      version.notes ?? "",
      problem.source ?? "",
      timeLimitSec,
      version.memoryLimitMb,
    ]
  );
  const hustojProblemId = result.insertId;

  await writeHustojData(hustojProblemId, version.testcases);

  await db.hustojProblemMap.create({
    data: {
      problemId,
      hustojProblemId,
    },
  });

  return hustojProblemId;
}

export async function syncHustojProblem(problemId: string) {
  const mapping = await db.hustojProblemMap.findUnique({
    where: { problemId },
  });
  if (!mapping) {
    return ensureHustojProblem(problemId);
  }

  const problem = await db.problem.findUnique({
    where: { id: problemId },
    include: {
      currentVersion: {
        include: { testcases: true },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { testcases: true },
      },
    },
  });
  const version = problem?.currentVersion ?? problem?.versions[0];
  if (!problem || !version) {
    throw new Error("problem_not_found");
  }

  const { input: sampleInput, output: sampleOutput } = getFirstSampleIO(version.samples);
  const timeLimitSec = Math.max(1, Math.round(version.timeLimitMs / 1000));

  const pool = getPool();
  await pool.query(
    "UPDATE problem SET title=?, description=?, input=?, output=?, sample_input=?, sample_output=?, hint=?, source=?, time_limit=?, memory_limit=?, defunct='N' WHERE problem_id=?",
    [
      problem.title,
      version.statementMd ?? version.statement ?? "",
      version.inputFormat ?? "",
      version.outputFormat ?? "",
      sampleInput,
      sampleOutput,
      version.notes ?? "",
      problem.source ?? "",
      timeLimitSec,
      version.memoryLimitMb,
      mapping.hustojProblemId,
    ]
  );

  await writeHustojData(mapping.hustojProblemId, version.testcases);
  return mapping.hustojProblemId;
}

export async function submitToHustoj(args: {
  problemId: string;
  userId: string;
  nick?: string;
  code: string;
  language: string;
  ip?: string;
}) {
  const pool = getPool();
  const hustojProblemId = await syncHustojProblem(args.problemId);
  const langId = mapLanguageToHustoj(args.language);
  const ip = args.ip ?? "0.0.0.0";
  const hustojUserId = normalizeHustojUserId(args.userId);
  const nick = normalizeHustojNick(args.nick ?? args.userId);

  const [solution] = await pool.query<mysql.ResultSetHeader>(
    "INSERT INTO solution (problem_id, user_id, nick, time, memory, in_date, result, language, ip, contest_id, valid, num, code_length, pass_rate, first_time, lint_error, judger, remote_oj, remote_id) VALUES (?, ?, ?, 0, 0, NOW(), 0, ?, ?, 0, 1, -1, ?, 0, 0, 0, 'LOCAL', '', '')",
    [hustojProblemId, hustojUserId, nick, langId, ip, args.code.length]
  );
  const solutionId = solution.insertId;

  await pool.query("INSERT INTO source_code (solution_id, source) VALUES (?, ?)", [
    solutionId,
    args.code,
  ]);

  return { hustojProblemId, solutionId, langId };
}

export async function getHustojResult(solutionId: number) {
  const pool = getPool();
  type HustojResultRow = RowDataPacket & {
    result: number;
    time: number;
    memory: number;
    pass_rate: number;
  };
  const [rows] = await pool.query<
    HustojResultRow[]
  >("SELECT result, time, memory, pass_rate FROM solution WHERE solution_id = ?", [solutionId]);
  return rows[0] ?? null;
}

export async function getHustojCompileInfo(solutionId: number) {
  const pool = getPool();
  type CompileInfoRow = RowDataPacket & { error: string | null };
  try {
    const [rows] = await pool.query<CompileInfoRow[]>(
      "SELECT error FROM compileinfo WHERE solution_id = ? LIMIT 1",
      [solutionId]
    );
    return rows[0]?.error ?? null;
  } catch {
    return null;
  }
}

export async function getHustojRuntimeInfo(solutionId: number) {
  const pool = getPool();
  type RuntimeInfoRow = RowDataPacket & { error: string | null };
  try {
    const [rows] = await pool.query<RuntimeInfoRow[]>(
      "SELECT error FROM runtimeinfo WHERE solution_id = ? LIMIT 1",
      [solutionId]
    );
    return rows[0]?.error ?? null;
  } catch {
    return null;
  }
}
