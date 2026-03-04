#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  referer: "https://www.luogu.com.cn/problem/list",
};

const TAGS_PATH = "https://www.luogu.com.cn/_lfe/tags/zh-CN";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_TAG_OVERRIDE_PATH = path.join(REPO_ROOT, "config", "luogu-tag-map.json");

function printUsage() {
  console.log(`Luogu tag normalization tool

Usage:
  node scripts/luogu-normalize-tags.mjs
  node scripts/luogu-normalize-tags.mjs --dry-run
  node scripts/luogu-normalize-tags.mjs --override-map ./config/luogu-tag-map.json

Options:
  --override-map      Override map file (default: ${DEFAULT_TAG_OVERRIDE_PATH})
  --timeout-ms        Luogu tag catalog request timeout (default: 15000)
  --dry-run           Preview only, do not write to database
`);
}

function parseArgs(argv) {
  const options = {
    overrideMap: DEFAULT_TAG_OVERRIDE_PATH,
    overrideMapProvided: false,
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
      case "--override-map":
        options.overrideMap = next ?? "";
        options.overrideMapProvided = true;
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

  return options;
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const remoteTagMap = await fetchLuoguTagCatalog(options.timeoutMs);
    const overrideMap = await loadOverrideMap(
      options.overrideMap,
      options.overrideMapProvided
    );

    const renames = Object.entries(overrideMap)
      .map(([id, canonicalName]) => ({
        id: String(id),
        sourceName: remoteTagMap[String(id)],
        canonicalName: String(canonicalName).trim(),
      }))
      .filter(
        (item) =>
          item.sourceName &&
          item.canonicalName &&
          item.sourceName.trim() &&
          item.canonicalName.trim() &&
          item.sourceName !== item.canonicalName
      );

    let renamedTags = 0;
    let mergedTags = 0;
    let movedProblemTags = 0;
    const applied = [];

    for (const item of renames) {
      const sourceTag = await prisma.tag.findUnique({
        where: { name: item.sourceName },
        select: {
          id: true,
          name: true,
          problems: {
            select: {
              problemId: true,
            },
          },
        },
      });

      if (!sourceTag) {
        continue;
      }

      const targetTag = await prisma.tag.findUnique({
        where: { name: item.canonicalName },
        select: {
          id: true,
          name: true,
        },
      });

      if (!targetTag) {
        if (!options.dryRun) {
          await prisma.tag.update({
            where: { id: sourceTag.id },
            data: { name: item.canonicalName },
          });
        }
        renamedTags += 1;
        movedProblemTags += sourceTag.problems.length;
        applied.push({
          mode: "rename",
          from: item.sourceName,
          to: item.canonicalName,
          problemCount: sourceTag.problems.length,
        });
        continue;
      }

      const relations = sourceTag.problems.map((problem) => ({
        problemId: problem.problemId,
        tagId: targetTag.id,
      }));

      if (!options.dryRun && relations.length) {
        await prisma.problemTag.createMany({
          data: relations,
          skipDuplicates: true,
        });
      }

      if (!options.dryRun) {
        await prisma.problemTag.deleteMany({
          where: { tagId: sourceTag.id },
        });
        await prisma.tag.delete({
          where: { id: sourceTag.id },
        });
      }

      mergedTags += 1;
      movedProblemTags += sourceTag.problems.length;
      applied.push({
        mode: "merge",
        from: item.sourceName,
        to: item.canonicalName,
        problemCount: sourceTag.problems.length,
      });
    }

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          renameRules: renames.length,
          renamedTags,
          mergedTags,
          movedProblemTags,
          applied,
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
