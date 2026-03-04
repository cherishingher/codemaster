#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "x-lentille-request": "content-only",
  referer: "https://www.luogu.com.cn/",
};

const IMPORT_PATH = "/api/admin/problems/import";
const TAGS_PATH = "https://www.luogu.com.cn/_lfe/tags/zh-CN";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_TAG_MAP_PATH = path.join(REPO_ROOT, "config", "luogu-tag-map.json");
const DEFAULT_PROBLEM_TAG_OVERRIDE_PATH = path.join(
  REPO_ROOT,
  "config",
  "luogu-problem-tag-overrides.json"
);

function printUsage() {
  console.log(`Luogu problem sync tool

Usage:
  node scripts/luogu-sync.mjs --pids P1001,P1000 [--output ./tmp/luogu.json]
  node scripts/luogu-sync.mjs --list-keyword "入门" --list-pages 2 --list-limit 20
  node scripts/luogu-sync.mjs --pids P1001 --base-url http://127.0.0.1:3001 --cookie "cm_session=..."

Options:
  --pids              Comma-separated Luogu problem IDs, e.g. P1001,P1000
  --list-keyword      Search Luogu problem list by keyword
  --list-page         Starting page for list mode (default: 1)
  --list-pages        Number of pages to fetch in list mode (default: 1)
  --list-limit        Maximum number of problems to fetch from list mode
  --output            Write normalized import payload to a JSON file
  --visibility        Imported visibility (default: public)
  --source-prefix     Source field prefix (default: luogu)
  --tag-map           JSON file mapping Luogu tag IDs to your platform tags
  --keep-tag-ids      Preserve unmapped tag IDs as luogu-tag:<id>
  --delay-ms          Delay between problem fetches (default: 400)
  --timeout-ms        Per-request timeout in milliseconds (default: 15000)
  --continue-on-error Skip failed problems and continue the batch
  --base-url          Import into CodeMaster, e.g. http://127.0.0.1:3001
  --import-url        Full import endpoint; overrides --base-url
  --cookie            Cookie header for admin import, e.g. cm_session=...

Notes:
  - The script only accesses public Luogu problem data.
  - Luogu tag names are fetched from ${TAGS_PATH}.
  - If ${DEFAULT_TAG_MAP_PATH} exists, it will be loaded automatically.
  - If ${DEFAULT_PROBLEM_TAG_OVERRIDE_PATH} exists, it will be loaded automatically.
  - By default it only writes JSON. Direct import requires --base-url/--import-url and --cookie.
`);
}

function parseArgs(argv) {
  const options = {
    pids: [],
    listKeyword: "",
    listPage: 1,
    listPages: 1,
    listLimit: null,
    output: "",
    visibility: "public",
    sourcePrefix: "luogu",
    tagMap: DEFAULT_TAG_MAP_PATH,
    tagMapProvided: false,
    problemTagOverrideMap: DEFAULT_PROBLEM_TAG_OVERRIDE_PATH,
    problemTagOverrideMapProvided: false,
    keepTagIds: false,
    delayMs: 400,
    timeoutMs: 15000,
    continueOnError: false,
    baseUrl: "",
    importUrl: "",
    cookie: process.env.CM_SESSION_COOKIE ?? "",
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
        options.pids = splitCsv(next);
        i += 1;
        break;
      case "--list-keyword":
        options.listKeyword = next ?? "";
        i += 1;
        break;
      case "--list-page":
        options.listPage = parsePositiveInt(next, 1);
        i += 1;
        break;
      case "--list-pages":
        options.listPages = parsePositiveInt(next, 1);
        i += 1;
        break;
      case "--list-limit":
        options.listLimit = parsePositiveInt(next, 1);
        i += 1;
        break;
      case "--output":
        options.output = next ?? "";
        i += 1;
        break;
      case "--visibility":
        options.visibility = next ?? "public";
        i += 1;
        break;
      case "--source-prefix":
        options.sourcePrefix = next ?? "luogu";
        i += 1;
        break;
      case "--tag-map":
        options.tagMap = next ?? "";
        options.tagMapProvided = true;
        i += 1;
        break;
      case "--problem-tag-overrides":
        options.problemTagOverrideMap = next ?? "";
        options.problemTagOverrideMapProvided = true;
        i += 1;
        break;
      case "--keep-tag-ids":
        options.keepTagIds = true;
        break;
      case "--delay-ms":
        options.delayMs = parsePositiveInt(next, 400);
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInt(next, 15000);
        i += 1;
        break;
      case "--continue-on-error":
        options.continueOnError = true;
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
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.pids.length && !options.listKeyword) {
    throw new Error("You must provide --pids or --list-keyword.");
  }

  if (options.baseUrl && !options.importUrl) {
    options.importUrl = `${options.baseUrl.replace(/\/+$/, "")}${IMPORT_PATH}`;
  }

  if (options.importUrl && !options.cookie) {
    throw new Error("Direct import requires --cookie or CM_SESSION_COOKIE.");
  }

  if (
    !["public", "private", "hidden", "contest"].includes(options.visibility)
  ) {
    throw new Error(
      `Unsupported visibility: ${options.visibility}. Use public/private/hidden/contest.`
    );
  }

  return options;
}

function splitCsv(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function unique(values) {
  return Array.from(new Set(values));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureProblemId(pid) {
  const normalized = String(pid).trim().toUpperCase();
  if (!/^P\d+[A-Z0-9-]*$/.test(normalized)) {
    throw new Error(`Unsupported Luogu problem ID: ${pid}`);
  }
  return normalized;
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
    throw new Error(
      `Luogu handshake failed (${first.status}) for ${url}: ${text.slice(0, 200)}`
    );
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
    throw new Error(
      `Luogu request failed (${second.status}) for ${url}: ${text.slice(0, 200)}`
    );
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

async function fetchLuoguProblem(pid, options) {
  const id = ensureProblemId(pid);
  const payload = await fetchLuoguJson(
    `https://www.luogu.com.cn/problem/${encodeURIComponent(id)}`,
    options.timeoutMs
  );
  const problem = payload?.data?.problem;
  if (!problem) {
    throw new Error(`Problem payload missing for ${id}`);
  }
  return problem;
}

async function fetchLuoguProblemListPage({ keyword, page, timeoutMs }) {
  const params = new URLSearchParams({
    type: "P",
    page: String(page),
  });
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  const payload = await fetchLuoguJson(
    `https://www.luogu.com.cn/problem/list?${params.toString()}`,
    timeoutMs
  );
  const result = payload?.data?.problems?.result;
  if (!Array.isArray(result)) {
    throw new Error(`Problem list payload missing for page ${page}`);
  }
  return result;
}

async function fetchLuoguTagCatalog(timeoutMs) {
  const payload = await fetchLuoguJson(TAGS_PATH, timeoutMs);
  const tags = payload?.tags;
  if (!Array.isArray(tags)) {
    throw new Error("Luogu tag catalog payload missing.");
  }
  const tagMap = {};
  for (const tag of tags) {
    if (
      tag &&
      (typeof tag.id === "number" || typeof tag.id === "string") &&
      typeof tag.name === "string" &&
      tag.name.trim()
    ) {
      tagMap[String(tag.id)] = tag.name.trim();
    }
  }
  return tagMap;
}

async function loadTagMap(filePath, { required = false } = {}) {
  if (!filePath) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Tag map must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (required) {
        throw new Error(`Tag map file not found: ${filePath}`);
      }
      return {};
    }
    throw error;
  }
}

async function loadProblemTagOverrides(filePath, { required = false } = {}) {
  if (!filePath) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Problem tag overrides must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (required) {
        throw new Error(`Problem tag override file not found: ${filePath}`);
      }
      return {};
    }
    throw error;
  }
}

function mapDifficulty(rawDifficulty) {
  const value = Number(rawDifficulty);
  if (!Number.isFinite(value)) return 2;
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  return 3;
}

function getLimitValue(values, fallback, divisor = 1) {
  if (!Array.isArray(values) || !values.length) return fallback;
  const numeric = values
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  if (!numeric.length) return fallback;
  return Math.max(...numeric) / divisor;
}

function buildStatementMarkdown(problem) {
  const content = problem?.content ?? {};
  const sections = [];

  if (typeof content.background === "string" && content.background.trim()) {
    sections.push(`## 题目背景\n\n${content.background.trim()}`);
  }

  if (typeof content.description === "string" && content.description.trim()) {
    sections.push(`## 题目描述\n\n${content.description.trim()}`);
  }

  if (typeof problem?.translation === "string" && problem.translation.trim()) {
    sections.push(`## 题意翻译\n\n${problem.translation.trim()}`);
  }

  if (!sections.length && typeof problem?.title === "string") {
    sections.push(`## 题目描述\n\n${problem.title.trim()}`);
  }

  return sections.join("\n\n");
}

function buildNotes(problem, normalizedDifficulty) {
  const rawTagIds = Array.isArray(problem.tags) ? problem.tags.join(", ") : "";
  const lines = [
    `Imported from Luogu`,
    `URL: https://www.luogu.com.cn/problem/${problem.pid}`,
    `Luogu PID: ${problem.pid}`,
    `Original difficulty: ${problem.difficulty}`,
    `Mapped difficulty: ${normalizedDifficulty}`,
  ];

  if (rawTagIds) {
    lines.push(`Luogu tag IDs: ${rawTagIds}`);
  }

  return lines.join("\n");
}

function mapTags(rawTagIds, tagMap, keepTagIds) {
  const result = [];
  const unmappedTagIds = [];
  for (const rawId of rawTagIds ?? []) {
    const mapped = tagMap[String(rawId)] ?? tagMap[rawId];
    if (Array.isArray(mapped)) {
      result.push(
        ...mapped.map((item) => String(item).trim()).filter(Boolean)
      );
      continue;
    }
    if (typeof mapped === "string" && mapped.trim()) {
      result.push(mapped.trim());
      continue;
    }
    unmappedTagIds.push(String(rawId));
    if (keepTagIds) {
      result.push(`luogu-tag:${rawId}`);
    }
  }
  return {
    tags: unique(result),
    unmappedTagIds: unique(unmappedTagIds),
  };
}

function normalizeSamples(rawSamples) {
  if (!Array.isArray(rawSamples)) return [];
  return rawSamples
    .map((item) => {
      if (!Array.isArray(item)) return null;
      const [input, output] = item;
      if (typeof input !== "string" || typeof output !== "string") return null;
      return { input, output };
    })
    .filter(Boolean);
}

function resolveManualProblemTags(problemOverrides, source, pid) {
  const bySource = problemOverrides[source];
  if (Array.isArray(bySource)) {
    return bySource.map((item) => String(item).trim()).filter(Boolean);
  }
  const byPid = problemOverrides[pid];
  if (Array.isArray(byPid)) {
    return byPid.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

function normalizeProblem(problem, options, tagMap, problemOverrides) {
  const statementMd = buildStatementMarkdown(problem);
  const content = problem?.content ?? {};
  const normalizedDifficulty = mapDifficulty(problem?.difficulty);
  const timeLimitMs = Math.ceil(getLimitValue(problem?.limits?.time, 1000));
  const memoryLimitMb = Math.ceil(
    getLimitValue(problem?.limits?.memory, 256 * 1024, 1024)
  );
  const source = `${options.sourcePrefix}:${problem.pid}`;
  const mappedTags = mapTags(problem?.tags ?? [], tagMap, options.keepTagIds);
  const manualTags = resolveManualProblemTags(problemOverrides, source, problem?.pid);

  return {
    title: String(problem?.title ?? problem?.pid ?? "").trim(),
    difficulty: normalizedDifficulty,
    visibility: options.visibility,
    source,
    tags: unique([...mappedTags.tags, ...manualTags]),
    unmappedTagIds: mappedTags.unmappedTagIds,
    versions: [
      {
        statement: statementMd,
        statementMd,
        constraints: "",
        hints:
          typeof content.hint === "string" && content.hint.trim()
            ? content.hint.trim()
            : undefined,
        inputFormat:
          typeof content.formatI === "string" && content.formatI.trim()
            ? content.formatI.trim()
            : undefined,
        outputFormat:
          typeof content.formatO === "string" && content.formatO.trim()
            ? content.formatO.trim()
            : undefined,
        samples: normalizeSamples(problem?.samples),
        notes: buildNotes(problem, normalizedDifficulty),
        timeLimitMs,
        memoryLimitMb,
      },
    ],
  };
}

async function resolveProblemIds(options) {
  const resolved = [...options.pids].map(ensureProblemId);

  if (!options.listKeyword) {
    return unique(resolved);
  }

  for (let offset = 0; offset < options.listPages; offset += 1) {
    const page = options.listPage + offset;
    console.log(`Resolving Luogu list page ${page}...`);
    const problems = await fetchLuoguProblemListPage({
      keyword: options.listKeyword,
      page,
      timeoutMs: options.timeoutMs,
    });
    resolved.push(...problems.map((item) => ensureProblemId(item.pid)));
    if (options.listLimit && resolved.length >= options.listLimit) {
      break;
    }
    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const uniqueIds = unique(resolved);
  return options.listLimit ? uniqueIds.slice(0, options.listLimit) : uniqueIds;
}

async function writePayloadFile(filePath, payload) {
  const target = path.resolve(filePath || "./tmp/luogu-import.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), "utf8");
  return target;
}

async function importPayload(importUrl, cookie, payload) {
  const res = await fetch(importUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`Import failed (${res.status}): ${body}`);
  }
  return body;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const remoteTagMap = await fetchLuoguTagCatalog(options.timeoutMs);
  const tagOverrides = await loadTagMap(options.tagMap, {
    required: options.tagMapProvided,
  });
  const problemOverrides = await loadProblemTagOverrides(
    options.problemTagOverrideMap,
    { required: options.problemTagOverrideMapProvided }
  );
  const tagMap = {
    ...remoteTagMap,
    ...tagOverrides,
  };
  console.log(
    `Loaded ${Object.keys(remoteTagMap).length} Luogu tags, ${Object.keys(tagOverrides).length} local tag override(s), and ${Object.keys(problemOverrides).length} per-problem override(s).`
  );
  const pids = await resolveProblemIds(options);

  if (!pids.length) {
    throw new Error("No Luogu problems matched the provided arguments.");
  }

  console.log(`Resolved ${pids.length} Luogu problem(s): ${pids.join(", ")}`);

  const normalizedProblems = [];
  const failures = [];
  const unmappedTagIds = new Set();
  for (let index = 0; index < pids.length; index += 1) {
    const pid = pids[index];
    console.log(`[${index + 1}/${pids.length}] Fetching ${pid}...`);
    try {
      const problem = await fetchLuoguProblem(pid, options);
      const normalized = normalizeProblem(problem, options, tagMap, problemOverrides);
      for (const rawId of normalized.unmappedTagIds) {
        unmappedTagIds.add(rawId);
      }
      delete normalized.unmappedTagIds;
      normalizedProblems.push(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!options.continueOnError) {
        throw error;
      }
      failures.push({ pid, message });
      console.error(`Skipping ${pid}: ${message}`);
    }
    if (options.delayMs > 0 && index < pids.length - 1) {
      await sleep(options.delayMs);
    }
  }

  if (!normalizedProblems.length) {
    throw new Error("No problems were fetched successfully.");
  }

  const payload = {
    problems: normalizedProblems,
  };

  const outputPath = await writePayloadFile(options.output, payload);
  console.log(`Payload written to ${outputPath}`);
  if (failures.length) {
    console.log(
      `Completed with ${failures.length} skipped problem(s): ${failures
        .map((item) => `${item.pid} (${item.message})`)
        .join("; ")}`
    );
  }
  if (unmappedTagIds.size) {
    console.log(
      `Unmapped Luogu tag IDs: ${Array.from(unmappedTagIds)
        .sort((a, b) => Number(a) - Number(b))
        .join(", ")}`
    );
    if (!options.keepTagIds) {
      console.log(
        `Update ${DEFAULT_TAG_MAP_PATH} or pass --keep-tag-ids to preserve raw tag IDs.`
      );
    }
  }

  if (options.importUrl) {
    console.log(`Importing into ${options.importUrl} ...`);
    const result = await importPayload(options.importUrl, options.cookie, payload);
    console.log(result);
  } else {
    console.log("Import skipped. Pass --base-url/--import-url and --cookie for direct import.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
