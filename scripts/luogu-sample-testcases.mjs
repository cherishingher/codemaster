#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";
import { execFile } from "child_process";
import { promisify } from "util";
import { PrismaClient } from "@prisma/client";

const execFileAsync = promisify(execFile);
const db = new PrismaClient();

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "x-lentille-request": "content-only",
  referer: "https://www.luogu.com.cn/",
};

const IMPORT_PATH = "/api/admin/testcases/import-zip";
const DEFAULT_OUTPUT_DIR = "./tmp/luogu-sample-testcases";
const DEFAULT_ZIP_OUTPUT = "./tmp/luogu-sample-testcases.zip";

function printUsage() {
  console.log(`Luogu public-sample testcase sync

Usage:
  node scripts/luogu-sample-testcases.mjs --pids P1001,P1002
  node scripts/luogu-sample-testcases.mjs --from P1001 --to P2001
  node scripts/luogu-sample-testcases.mjs --pids P1001 --base-url http://127.0.0.1:3001 --cookie "cm_session=..."

Options:
  --pids                Comma-separated Luogu problem IDs, e.g. P1001,P1002
  --from                Inclusive start PID, e.g. P1001
  --to                  Inclusive end PID, e.g. P2001
  --limit               Maximum number of matched problems to process
  --output-dir          Directory for generated testcase tree (default: ${DEFAULT_OUTPUT_DIR})
  --zip-output          ZIP file path to generate (default: ${DEFAULT_ZIP_OUTPUT})
  --refresh-remote      Always refetch public samples from Luogu
  --delay-ms            Delay between Luogu requests when remote fetch is used (default: 300)
  --timeout-ms          Per-request timeout in milliseconds (default: 15000)
  --continue-on-error   Skip failed problems and continue
  --overwrite-existing  Include problems that already have testcases
  --base-url            Import into CodeMaster, e.g. http://127.0.0.1:3001
  --import-url          Full batch testcase import endpoint; overrides --base-url
  --cookie              Cookie header for admin import, e.g. cm_session=...
  --skip-sync           Skip HUSTOJ sync on import (default: true)
  --sync-hustoj         Enable HUSTOJ sync on import

Notes:
  - Default behavior only processes Luogu problems that currently have no testcase rows.
  - Generated testcases are public samples only. They are not a substitute for hidden judge data.
  - Each generated testcase is marked as sample/visible through config.yml.
`);
}

function splitCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function ensureProblemId(pid) {
  const normalized = String(pid).trim().toUpperCase();
  if (!/^P\d+[A-Z0-9-]*$/.test(normalized)) {
    throw new Error(`Unsupported Luogu problem ID: ${pid}`);
  }
  return normalized;
}

function pidNumber(pid) {
  const match = ensureProblemId(pid).match(/^P(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

function parseArgs(argv) {
  const options = {
    pids: [],
    from: "",
    to: "",
    limit: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    zipOutput: DEFAULT_ZIP_OUTPUT,
    refreshRemote: false,
    delayMs: 300,
    timeoutMs: 15000,
    continueOnError: false,
    overwriteExisting: false,
    baseUrl: "",
    importUrl: "",
    cookie: process.env.CM_SESSION_COOKIE ?? "",
    skipSync: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      case "--pids":
        options.pids = splitCsv(next).map(ensureProblemId);
        i += 1;
        break;
      case "--from":
        options.from = ensureProblemId(next);
        i += 1;
        break;
      case "--to":
        options.to = ensureProblemId(next);
        i += 1;
        break;
      case "--limit":
        options.limit = parsePositiveInt(next, 1);
        i += 1;
        break;
      case "--output-dir":
        options.outputDir = next ?? DEFAULT_OUTPUT_DIR;
        i += 1;
        break;
      case "--zip-output":
        options.zipOutput = next ?? DEFAULT_ZIP_OUTPUT;
        i += 1;
        break;
      case "--refresh-remote":
        options.refreshRemote = true;
        break;
      case "--delay-ms":
        options.delayMs = parsePositiveInt(next, 300);
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInt(next, 15000);
        i += 1;
        break;
      case "--continue-on-error":
        options.continueOnError = true;
        break;
      case "--overwrite-existing":
        options.overwriteExisting = true;
        break;
      case "--base-url":
        options.baseUrl = next ?? "";
        i += 1;
        break;
      case "--import-url":
        options.importUrl = next ?? "";
        i += 1;
        break;
      case "--cookie":
        options.cookie = next ?? "";
        i += 1;
        break;
      case "--skip-sync":
        options.skipSync = true;
        break;
      case "--sync-hustoj":
        options.skipSync = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.pids.length && !options.from && !options.to) {
    console.log("No PID filter provided. The script will scan all source=luogu:* problems.");
  }

  if (options.baseUrl && !options.importUrl) {
    options.importUrl = `${options.baseUrl.replace(/\/+$/, "")}${IMPORT_PATH}`;
  }

  if (options.importUrl && !options.cookie) {
    throw new Error("Direct import requires --cookie or CM_SESSION_COOKIE.");
  }

  if ((options.from && !options.to) || (!options.from && options.to)) {
    throw new Error("--from and --to must be provided together.");
  }

  if (options.from && options.to && pidNumber(options.from) > pidNumber(options.to)) {
    throw new Error("--from must be <= --to.");
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLuoguJson(url, timeoutMs) {
  const first = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (first.ok) {
    return first.json();
  }

  const cookie = first.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    const text = await first.text();
    throw new Error(`Luogu handshake failed (${first.status}) for ${url}: ${text.slice(0, 200)}`);
  }

  const second = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      cookie,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await second.text();
  if (!second.ok) {
    throw new Error(`Luogu request failed (${second.status}) for ${url}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Luogu response is not valid JSON for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function fetchLuoguProblem(pid, timeoutMs) {
  const payload = await fetchLuoguJson(
    `https://www.luogu.com.cn/problem/${encodeURIComponent(ensureProblemId(pid))}`,
    timeoutMs
  );
  const problem = payload?.data?.problem;
  if (!problem) {
    throw new Error(`Problem payload missing for ${pid}`);
  }
  return problem;
}

function normalizeSamples(rawSamples) {
  if (!Array.isArray(rawSamples)) return [];
  return rawSamples
    .map((item) => {
      if (Array.isArray(item)) {
        const [input, output] = item;
        if (typeof input === "string" && typeof output === "string") {
          return { input, output };
        }
        return null;
      }
      if (!item || typeof item !== "object") return null;
      const input = typeof item.input === "string" ? item.input : null;
      const output = typeof item.output === "string" ? item.output : null;
      if (!input || output === null) return null;
      return { input, output };
    })
    .filter(Boolean);
}

function buildScores(count) {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildConfigYaml(samples) {
  const scores = buildScores(samples.length);
  return samples
    .map((_, index) => {
      const order = index + 1;
      return [
        `${order}.in:`,
        `  score: ${scores[index] ?? 0}`,
        `  isSample: true`,
        `  visible: true`,
        `  caseType: 0`,
        `  title: sample-${order}`,
        "",
      ].join("\n");
    })
    .join("\n")
    .trimEnd()
    .concat("\n");
}

function extractPidFromSource(source) {
  if (typeof source !== "string") return "";
  const match = source.match(/^luogu:(P\d+[A-Z0-9-]*)$/i);
  return match ? ensureProblemId(match[1]) : "";
}

function shouldIncludeProblem(problem, options) {
  const pid = extractPidFromSource(problem.source);
  if (!pid) return false;
  if (options.pids.length && !options.pids.includes(pid)) return false;
  if (options.from && options.to) {
    const number = pidNumber(pid);
    if (number < pidNumber(options.from) || number > pidNumber(options.to)) {
      return false;
    }
  }
  return true;
}

async function listLuoguProblems(options) {
  const rows = await db.problem.findMany({
    where: { source: { startsWith: "luogu:" } },
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
      currentVersion: {
        select: {
          id: true,
          samples: true,
          testcases: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { source: "asc" },
  });

  const filtered = rows.filter((problem) => shouldIncludeProblem(problem, options));
  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

async function resolveSamples(problem, options) {
  const storedSamples = normalizeSamples(problem.currentVersion?.samples);
  if (storedSamples.length > 0 && !options.refreshRemote) {
    return { samples: storedSamples, from: "db" };
  }

  const pid = extractPidFromSource(problem.source);
  if (!pid) {
    return { samples: storedSamples, from: "db" };
  }

  const remote = await fetchLuoguProblem(pid, options.timeoutMs);
  const remoteSamples = normalizeSamples(remote?.samples);
  if (remoteSamples.length > 0) {
    return { samples: remoteSamples, from: "remote" };
  }
  return { samples: storedSamples, from: storedSamples.length > 0 ? "db" : "remote" };
}

async function prepareOutputDir(outputDir) {
  const resolved = path.resolve(outputDir);
  await fs.rm(resolved, { recursive: true, force: true });
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

async function writeProblemSampleDir(outputDir, problem, samples) {
  const targetDir = path.join(outputDir, problem.slug);
  await fs.mkdir(targetDir, { recursive: true });
  for (let index = 0; index < samples.length; index += 1) {
    const order = index + 1;
    await fs.writeFile(path.join(targetDir, `${order}.in`), samples[index].input, "utf8");
    await fs.writeFile(path.join(targetDir, `${order}.out`), samples[index].output, "utf8");
  }
  await fs.writeFile(path.join(targetDir, "config.yml"), buildConfigYaml(samples), "utf8");
}

async function zipDirectory(outputDir, zipOutput) {
  const zipPath = path.resolve(zipOutput);
  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.rm(zipPath, { force: true });
  await execFileAsync("zip", ["-qr", zipPath, "."], {
    cwd: outputDir,
  });
  return zipPath;
}

async function importZip(importUrl, cookie, zipPath, skipSync) {
  const fileBuffer = await fs.readFile(zipPath);
  const form = new FormData();
  form.append("zip", new Blob([fileBuffer]), path.basename(zipPath));
  form.append("skipSync", String(skipSync));

  const res = await fetch(importUrl, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`Batch testcase import failed (${res.status}): ${body}`);
  }
  return body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const problems = await listLuoguProblems(options);
  if (!problems.length) {
    throw new Error("No luogu problems matched the provided filters.");
  }

  console.log(`Matched ${problems.length} Luogu problem(s).`);

  const outputDir = await prepareOutputDir(options.outputDir);
  const summary = {
    matched: problems.length,
    generated: 0,
    skippedExisting: 0,
    skippedNoSamples: 0,
    failed: 0,
  };
  const details = [];

  for (let index = 0; index < problems.length; index += 1) {
    const problem = problems[index];
    console.log(`[${index + 1}/${problems.length}] ${problem.slug} (${problem.source})`);

    if (!options.overwriteExisting && (problem.currentVersion?.testcases?.length ?? 0) > 0) {
      summary.skippedExisting += 1;
      details.push({
        slug: problem.slug,
        source: problem.source,
        ok: false,
        reason: "existing_testcases",
      });
      continue;
    }

    try {
      const { samples, from } = await resolveSamples(problem, options);
      if (!samples.length) {
        summary.skippedNoSamples += 1;
        details.push({
          slug: problem.slug,
          source: problem.source,
          ok: false,
          reason: "no_public_samples",
        });
      } else {
        await writeProblemSampleDir(outputDir, problem, samples);
        summary.generated += 1;
        details.push({
          slug: problem.slug,
          source: problem.source,
          ok: true,
          sampleCount: samples.length,
          sampleSource: from,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      details.push({
        slug: problem.slug,
        source: problem.source,
        ok: false,
        reason: "fetch_failed",
        detail: message,
      });
      if (!options.continueOnError) {
        throw error;
      }
      console.error(`Skipping ${problem.slug}: ${message}`);
    }

    if (options.refreshRemote && options.delayMs > 0 && index < problems.length - 1) {
      await sleep(options.delayMs);
    }
  }

  if (summary.generated === 0) {
    throw new Error("No testcase directories were generated.");
  }

  const zipPath = await zipDirectory(outputDir, options.zipOutput);
  console.log(`Generated testcase directories: ${path.resolve(outputDir)}`);
  console.log(`Generated ZIP: ${zipPath}`);
  console.log(JSON.stringify(summary, null, 2));

  const detailPath = path.join(path.dirname(zipPath), `${path.basename(zipPath, ".zip")}.summary.json`);
  await fs.writeFile(detailPath, JSON.stringify({ summary, details }, null, 2), "utf8");
  console.log(`Summary written to ${detailPath}`);

  if (options.importUrl) {
    console.log(`Importing into ${options.importUrl} ...`);
    const result = await importZip(options.importUrl, options.cookie, zipPath, options.skipSync);
    console.log(result);
  } else {
    console.log("Import skipped. Pass --base-url/--import-url and --cookie for direct import.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
