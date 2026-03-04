#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "x-lentille-request": "content-only",
  referer: "https://www.luogu.com.cn/problem/list",
};

const TAGS_PATH = "https://www.luogu.com.cn/_lfe/tags/zh-CN";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_TAG_OVERRIDE_PATH = path.join(REPO_ROOT, "config", "luogu-tag-map.json");
const DEFAULT_PROBLEM_TAG_OVERRIDE_PATH = path.join(
  REPO_ROOT,
  "config",
  "luogu-problem-tag-overrides.json"
);

function printUsage() {
  console.log(`Luogu tag backfill tool

Usage:
  node scripts/luogu-backfill-tags.mjs
  node scripts/luogu-backfill-tags.mjs --source luogu:P1001,luogu:P1002
  node scripts/luogu-backfill-tags.mjs --from 1001 --to 2001

Options:
  --source            Comma-separated problem sources, e.g. luogu:P1001,luogu:P1002
  --from              Start Luogu numeric range, e.g. 1001
  --to                End Luogu numeric range, e.g. 2001
  --override-map      Optional local override file (default: ${DEFAULT_TAG_OVERRIDE_PATH})
  --problem-overrides Optional per-problem tag override file (default: ${DEFAULT_PROBLEM_TAG_OVERRIDE_PATH})
  --timeout-ms        Luogu tag catalog request timeout (default: 15000)
  --dry-run           Preview only, do not write to database
`);
}

function parseArgs(argv) {
  const options = {
    sources: [],
    from: null,
    to: null,
    overrideMap: DEFAULT_TAG_OVERRIDE_PATH,
    overrideMapProvided: false,
    problemOverrideMap: DEFAULT_PROBLEM_TAG_OVERRIDE_PATH,
    problemOverrideMapProvided: false,
    timeoutMs: 15000,
    dryRun: false,
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
      case "--source":
        options.sources = (next ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        i += 1;
        break;
      case "--from":
        options.from = parsePositiveInt(next);
        i += 1;
        break;
      case "--to":
        options.to = parsePositiveInt(next);
        i += 1;
        break;
      case "--override-map":
        options.overrideMap = next ?? "";
        options.overrideMapProvided = true;
        i += 1;
        break;
      case "--problem-overrides":
        options.problemOverrideMap = next ?? "";
        options.problemOverrideMapProvided = true;
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInt(next) ?? 15000;
        i += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if ((options.from && !options.to) || (!options.from && options.to)) {
    throw new Error("--from and --to must be provided together.");
  }

  if (options.from && options.to && options.from > options.to) {
    throw new Error("--from must be less than or equal to --to.");
  }

  return options;
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
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

  return JSON.parse(text);
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

async function fetchLuoguProblem(pid, timeoutMs) {
  const payload = await fetchLuoguJson(
    `https://www.luogu.com.cn/problem/${encodeURIComponent(pid)}`,
    timeoutMs
  );
  const problem = payload?.data?.problem;
  if (!problem) {
    throw new Error(`Problem payload missing for ${pid}`);
  }
  return problem;
}

async function loadOverrideMap(filePath, required) {
  if (!filePath) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Override map must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (required) {
        throw new Error(`Override map file not found: ${filePath}`);
      }
      return {};
    }
    throw error;
  }
}

async function loadProblemOverrides(filePath, required) {
  if (!filePath) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Problem overrides must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      if (required) {
        throw new Error(`Problem override file not found: ${filePath}`);
      }
      return {};
    }
    throw error;
  }
}

function parseLuoguTagIds(notes) {
  if (typeof notes !== "string") return [];
  const match = notes.match(/Luogu tag IDs:\s*([^\n]+)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractPidFromSource(source) {
  const match = String(source).match(/^luogu:(P\d+[A-Z0-9-]*)$/i);
  return match ? match[1].toUpperCase() : null;
}

function unique(values) {
  return Array.from(new Set(values));
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

function buildWhereClause(options) {
  if (options.sources.length) {
    return { source: { in: options.sources } };
  }
  if (options.from && options.to) {
    const sources = [];
    for (let n = options.from; n <= options.to; n += 1) {
      sources.push(`luogu:P${n}`);
    }
    return { source: { in: sources } };
  }
  return { source: { startsWith: "luogu:P" } };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const remoteTagMap = await fetchLuoguTagCatalog(options.timeoutMs);
    const overrideMap = await loadOverrideMap(
      options.overrideMap,
      options.overrideMapProvided
    );
    const problemOverrides = await loadProblemOverrides(
      options.problemOverrideMap,
      options.problemOverrideMapProvided
    );
    const tagMap = {
      ...remoteTagMap,
      ...overrideMap,
    };

    const problems = await prisma.problem.findMany({
      where: buildWhereClause(options),
      select: {
        id: true,
        source: true,
        title: true,
        currentVersion: {
          select: {
            notes: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        source: "asc",
      },
    });

    const desiredTagNamesByProblem = new Map();
    const allTagNames = new Set();
    const unmappedIds = new Set();
    let refreshedFromRemote = 0;
    let manualOverrideHits = 0;
    let skippedWithoutTags = 0;

    for (const problem of problems) {
      const pid = extractPidFromSource(problem.source);
      let rawIds = parseLuoguTagIds(problem.currentVersion?.notes);
      if (!rawIds.length && pid) {
        try {
          const remoteProblem = await fetchLuoguProblem(pid, options.timeoutMs);
          rawIds = Array.isArray(remoteProblem.tags)
            ? remoteProblem.tags.map((item) => String(item).trim()).filter(Boolean)
            : [];
          if (rawIds.length) {
            refreshedFromRemote += 1;
          }
        } catch (error) {
          console.error(
            `Failed to refresh Luogu tags for ${problem.source}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      const desired = [];
      for (const rawId of rawIds) {
        const mapped = tagMap[String(rawId)];
        if (typeof mapped === "string" && mapped.trim()) {
          desired.push(mapped.trim());
          allTagNames.add(mapped.trim());
        } else {
          unmappedIds.add(String(rawId));
        }
      }
      const manualTags = resolveManualProblemTags(
        problemOverrides,
        problem.source,
        pid ?? ""
      );
      if (manualTags.length) {
        manualOverrideHits += 1;
        desired.push(...manualTags);
        for (const name of manualTags) {
          allTagNames.add(name);
        }
      }
      const finalTags = unique(desired);
      if (!finalTags.length) {
        skippedWithoutTags += 1;
        continue;
      }
      desiredTagNamesByProblem.set(problem.id, finalTags);
    }

    if (!allTagNames.size) {
      console.log("No mapped Luogu tags found for the selected problems.");
      if (unmappedIds.size) {
        console.log(`Unmapped Luogu tag IDs: ${Array.from(unmappedIds).sort((a, b) => Number(a) - Number(b)).join(", ")}`);
      }
      return;
    }

    const existingTags = await prisma.tag.findMany({
      where: {
        name: {
          in: Array.from(allTagNames),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const existingTagMap = new Map(existingTags.map((tag) => [tag.name, tag.id]));

    const missingTagNames = Array.from(allTagNames).filter((name) => !existingTagMap.has(name));
    if (!options.dryRun) {
      for (const name of missingTagNames) {
        const tag = await prisma.tag.upsert({
          where: { name },
          create: { name },
          update: {},
          select: { id: true, name: true },
        });
        existingTagMap.set(tag.name, tag.id);
      }
    } else {
      for (const name of missingTagNames) {
        existingTagMap.set(name, `dry-run:${name}`);
      }
    }

    const createRows = [];
    let taggedProblems = 0;
    for (const problem of problems) {
      const desiredTagNames = desiredTagNamesByProblem.get(problem.id) ?? [];
      if (!desiredTagNames.length) continue;
      const existingNames = new Set(problem.tags.map((item) => item.tag.name));
      let hasNewTag = false;
      for (const name of desiredTagNames) {
        if (existingNames.has(name)) continue;
        const tagId = existingTagMap.get(name);
        if (!tagId) continue;
        createRows.push({
          problemId: problem.id,
          tagId,
        });
        hasNewTag = true;
      }
      if (hasNewTag) {
        taggedProblems += 1;
      }
    }

    if (!options.dryRun && createRows.length) {
      const chunkSize = 500;
      for (let i = 0; i < createRows.length; i += chunkSize) {
        await prisma.problemTag.createMany({
          data: createRows.slice(i, i + chunkSize),
          skipDuplicates: true,
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          problemsScanned: problems.length,
          problemsTagged: taggedProblems,
          tagsCreated: options.dryRun ? missingTagNames.length : missingTagNames.length,
          problemTagsCreated: createRows.length,
          refreshedFromRemote,
          manualOverrideHits,
          skippedWithoutTags,
          unmappedIds: Array.from(unmappedIds).sort((a, b) => Number(a) - Number(b)),
          dryRun: options.dryRun,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
