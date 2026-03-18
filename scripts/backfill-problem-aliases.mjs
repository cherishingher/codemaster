#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeProblemAlias(value) {
  return String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function buildSourceDerivedAliases(source) {
  const raw = String(source ?? "").trim();
  if (!raw) return [];
  const match = raw.match(/^([a-z0-9_-]+):([A-Za-z0-9._-]+)$/i);
  if (!match) return [];
  const provider = match[1].trim();
  const externalId = match[2].trim();
  if (!provider || !externalId) return [];
  return [`${provider}${externalId}`];
}

function parseArgs(argv) {
  const options = {
    sourcePrefix: null,
    source: [],
    dryRun: false,
    limit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source-prefix") {
      options.sourcePrefix = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--source") {
      const raw = argv[i + 1] ?? "";
      options.source = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      const value = Number(argv[i + 1] ?? "");
      options.limit = Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function buildWhere(options) {
  if (options.source.length > 0) {
    return { source: { in: options.source } };
  }
  if (options.sourcePrefix?.trim()) {
    return { source: { startsWith: `${options.sourcePrefix.trim()}:` } };
  }
  return { source: { not: null } };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const problems = await prisma.problem.findMany({
    where: buildWhere(options),
    take: options.limit ?? undefined,
    orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      source: true,
      aliases: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          value: true,
          normalizedValue: true,
        },
      },
    },
  });

  let updated = 0;
  let skipped = 0;
  const results = [];

  for (const problem of problems) {
    const derived = buildSourceDerivedAliases(problem.source);
    if (derived.length === 0) {
      skipped += 1;
      results.push({
        slug: problem.slug,
        source: problem.source,
        status: "skip",
        reason: "source_not_supported",
      });
      continue;
    }

    const existingNormalized = new Set(problem.aliases.map((item) => item.normalizedValue));
    const toCreate = derived
      .map((value) => ({
        value,
        normalizedValue: normalizeProblemAlias(value),
      }))
      .filter((item) => !existingNormalized.has(item.normalizedValue));

    if (toCreate.length === 0) {
      skipped += 1;
      results.push({
        slug: problem.slug,
        source: problem.source,
        status: "skip",
        reason: "already_present",
      });
      continue;
    }

    if (!options.dryRun) {
      const nextOrder = problem.aliases.length;
      await prisma.problemAlias.createMany({
        data: toCreate.map((item, index) => ({
          problemId: problem.id,
          value: item.value,
          normalizedValue: item.normalizedValue,
          sortOrder: nextOrder + index,
        })),
        skipDuplicates: true,
      });
    }

    updated += 1;
    results.push({
      slug: problem.slug,
      source: problem.source,
      status: options.dryRun ? "would-update" : "updated",
      aliases: toCreate.map((item) => item.value),
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: options.dryRun,
        matched: problems.length,
        updated,
        skipped,
        results,
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
