import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { storeTextAsset } from "@/lib/storage";
import { readZipEntries } from "@/lib/zip";
import { syncHustojProblem } from "@/lib/hustoj";

const DEFAULT_MAX_ZIP_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_TESTCASE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_TESTCASE_COUNT = 500;

function readLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const MAX_ZIP_BYTES = readLimit(
  process.env.MAX_TESTCASE_ZIP_BYTES,
  DEFAULT_MAX_ZIP_BYTES
);
const MAX_TESTCASE_BYTES = readLimit(
  process.env.MAX_TESTCASE_FILE_BYTES,
  DEFAULT_MAX_TESTCASE_BYTES
);
const MAX_TESTCASE_COUNT = readLimit(
  process.env.MAX_TESTCASE_COUNT,
  DEFAULT_MAX_TESTCASE_COUNT
);

function normalizeName(path: string) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

type Pair = { input?: string; output?: string };
type CaseConfig = {
  timeLimitMs?: number;
  memoryLimitKb?: number;
  score?: number;
  isPretest?: boolean;
  subtaskId?: number;
};

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseConfigYaml(text: string) {
  const configs = new Map<string, CaseConfig>();
  let currentKey: string | null = null;
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!line.startsWith(" ")) {
      const topMatch = line.match(/^([^:#]+):\s*$/);
      if (topMatch) {
        currentKey = topMatch[1].trim();
        if (currentKey) configs.set(currentKey, {});
      } else {
        currentKey = null;
      }
      continue;
    }
    if (!currentKey) continue;
    const kvMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)\s*$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    let valueRaw = kvMatch[2];
    const hashIndex = valueRaw.indexOf(" #");
    if (hashIndex >= 0) valueRaw = valueRaw.slice(0, hashIndex).trim();
    const value = parseScalar(valueRaw);
    const cfg = configs.get(currentKey) ?? {};
    switch (key) {
      case "timeLimit":
      case "timeLimitMs":
        if (typeof value === "number") cfg.timeLimitMs = value;
        break;
      case "memoryLimit":
      case "memoryLimitKb":
        if (typeof value === "number") cfg.memoryLimitKb = value;
        break;
      case "score":
        if (typeof value === "number") cfg.score = value;
        break;
      case "isPretest":
        if (typeof value === "boolean") cfg.isPretest = value;
        break;
      case "subtaskId":
        if (typeof value === "number") cfg.subtaskId = value;
        break;
      default:
        break;
    }
    configs.set(currentKey, cfg);
  }
  return configs;
}

function isValidInt(value: number, min = 0) {
  return Number.isFinite(value) && Number.isInteger(value) && value >= min;
}

export const POST = withAuth(async (req, { params }) => {
  const form = await req.formData();
  const file = form.get("zip");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "zip_file_required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "zip_empty" }, { status: 400 });
  }

  if (file.size > MAX_ZIP_BYTES) {
    return NextResponse.json(
      {
        error: "zip_too_large",
        detail: { size: file.size, limit: MAX_ZIP_BYTES },
      },
      { status: 400 }
    );
  }

  const problemId = params.id;
  const filename = file.name || "";
  if (!filename.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "zip_extension_required" }, { status: 400 });
  }
  const baseName = filename.slice(0, -4);
  if (baseName !== problemId) {
    return NextResponse.json(
      { error: "zip_name_mismatch", detail: `expected ${problemId}.zip` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawEntries = await readZipEntries(buffer);
  const entries = new Map<string, Buffer>();
  for (const [path, data] of rawEntries.entries()) {
    const normalized = normalizeName(path);
    if (!normalized) continue;
    entries.set(normalized, data);
  }

  const warnings: Array<{ code: string; detail?: unknown }> = [];
  const pairs = new Map<number, Pair>();
  const invalidCaseNames: string[] = [];
  const duplicateCaseFiles: string[] = [];
  const inputFiles = new Map<number, string>();
  const outputFiles = new Map<number, string>();
  for (const [raw, data] of entries.entries()) {
    const name = raw.split("/").pop() || raw;
    const isInput = /\.in$/i.test(name);
    const isOutput = /\.out$/i.test(name);
    if (!isInput && !isOutput) continue;

    const match = name.match(/(\d+)\.(in|out)$/i);
    if (!match) {
      invalidCaseNames.push(name);
      continue;
    }
    const index = Number(match[1]);
    if (!Number.isFinite(index)) {
      invalidCaseNames.push(name);
      continue;
    }
    if (data.length > MAX_TESTCASE_BYTES) {
      return NextResponse.json(
        {
          error: "entry_too_large",
          detail: { path: name, size: data.length, limit: MAX_TESTCASE_BYTES },
        },
        { status: 400 }
      );
    }

    if (isInput) {
      if (inputFiles.has(index)) {
        duplicateCaseFiles.push(name);
        continue;
      }
      inputFiles.set(index, name);
    }
    if (isOutput) {
      if (outputFiles.has(index)) {
        duplicateCaseFiles.push(name);
        continue;
      }
      outputFiles.set(index, name);
    }

    const content = data.toString("utf8");
    const existing = pairs.get(index) ?? {};
    if (isInput) existing.input = content;
    if (isOutput) existing.output = content;
    pairs.set(index, existing);
  }

  if (invalidCaseNames.length) {
    return NextResponse.json(
      { error: "invalid_case_filename", detail: invalidCaseNames },
      { status: 400 }
    );
  }

  if (duplicateCaseFiles.length) {
    return NextResponse.json(
      { error: "duplicate_case_files", detail: duplicateCaseFiles },
      { status: 400 }
    );
  }

  if (
    pairs.size > MAX_TESTCASE_COUNT ||
    inputFiles.size > MAX_TESTCASE_COUNT ||
    outputFiles.size > MAX_TESTCASE_COUNT
  ) {
    return NextResponse.json(
      {
        error: "testcase_count_limit",
        detail: {
          limit: MAX_TESTCASE_COUNT,
          inputs: inputFiles.size,
          outputs: outputFiles.size,
        },
      },
      { status: 400 }
    );
  }

  if (!pairs.size) {
    return NextResponse.json({ error: "no_testcases_found" }, { status: 400 });
  }

  let configByIndex = new Map<number, CaseConfig>();
  const configNameByIndex = new Map<number, string>();
  const duplicateConfigEntries: string[] = [];
  const configEntry =
    entries.get("config.yml") ??
    entries.get("config.yaml") ??
    Array.from(entries.entries()).find(([path]) => {
      const base = path.split("/").pop() || path;
      return base === "config.yml" || base === "config.yaml";
    })?.[1];

  if (configEntry) {
    const configs = parseConfigYaml(configEntry.toString("utf8"));
    const unknown: string[] = [];
    for (const [name, cfg] of configs.entries()) {
      const base = name.split("/").pop() || name;
      const match = base.match(/(\d+)\.in$/i);
      if (!match) {
        unknown.push(name);
        continue;
      }
      const idx = Number(match[1]);
      if (!Number.isFinite(idx)) {
        unknown.push(name);
        continue;
      }
      if (configByIndex.has(idx)) {
        duplicateConfigEntries.push(name);
        continue;
      }
      configByIndex.set(idx, cfg);
      configNameByIndex.set(idx, base);
    }
    if (unknown.length) {
      return NextResponse.json(
        { error: "config_unknown_inputs", detail: unknown },
        { status: 400 }
      );
    }
    if (duplicateConfigEntries.length) {
      return NextResponse.json(
        { error: "duplicate_config_entries", detail: duplicateConfigEntries },
        { status: 400 }
      );
    }
    const missingCases: number[] = [];
    for (const idx of configByIndex.keys()) {
      if (!pairs.has(idx)) missingCases.push(idx);
    }
    if (missingCases.length) {
      return NextResponse.json(
        { error: "config_missing_cases", detail: missingCases },
        { status: 400 }
      );
    }

    const invalidConfig: Array<{ name: string; field: string; value: unknown }> = [];
    for (const [idx, cfg] of configByIndex.entries()) {
      const name = configNameByIndex.get(idx) ?? `${idx}.in`;
      if (cfg.score !== undefined && !isValidInt(cfg.score, 0)) {
        invalidConfig.push({ name, field: "score", value: cfg.score });
      }
      if (cfg.timeLimitMs !== undefined && !isValidInt(cfg.timeLimitMs, 1)) {
        invalidConfig.push({ name, field: "timeLimitMs", value: cfg.timeLimitMs });
      }
      if (cfg.memoryLimitKb !== undefined && !isValidInt(cfg.memoryLimitKb, 1)) {
        invalidConfig.push({ name, field: "memoryLimitKb", value: cfg.memoryLimitKb });
      }
      if (cfg.subtaskId !== undefined && !isValidInt(cfg.subtaskId, 1)) {
        invalidConfig.push({ name, field: "subtaskId", value: cfg.subtaskId });
      }
    }
    if (invalidConfig.length) {
      return NextResponse.json(
        { error: "invalid_config_values", detail: invalidConfig },
        { status: 400 }
      );
    }
  }

  const missing: number[] = [];
  const ordered = Array.from(pairs.entries()).sort((a, b) => a[0] - b[0]);
  for (const [idx, pair] of ordered) {
    if (!pair.input || !pair.output) missing.push(idx);
  }
  if (missing.length) {
    return NextResponse.json({ error: "missing_pairs", detail: missing }, { status: 400 });
  }

  if (ordered.length) {
    const indices = ordered.map(([idx]) => idx);
    const minIndex = indices[0];
    const maxIndex = indices[indices.length - 1];
    if (minIndex !== 1) {
      warnings.push({ code: "indices_not_starting_at_1", detail: { start: minIndex } });
    }
    const missingIndices: number[] = [];
    for (let i = minIndex; i <= maxIndex; i += 1) {
      if (!pairs.has(i)) missingIndices.push(i);
    }
    if (missingIndices.length) {
      warnings.push({
        code: "indices_not_contiguous",
        detail: {
          total: missingIndices.length,
          sample: missingIndices.slice(0, 50),
        },
      });
    }
    if (configEntry && configByIndex.size && configByIndex.size < pairs.size) {
      warnings.push({
        code: "config_partial",
        detail: { configured: configByIndex.size, total: pairs.size },
      });
    }
  }

  const version = await db.problemVersion.findFirst({
    where: { problemId },
    orderBy: { version: "desc" },
  });
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  const previousRows = await db.testcase.findMany({ where: { versionId: version.id } });
  const rollbackRows = previousRows.map(({ id, ...rest }) => rest);

  const rows = [] as {
    versionId: string;
    inputUri: string;
    outputUri: string;
    score: number;
    timeLimitMs?: number;
    memoryLimitKb?: number;
    subtaskId?: number;
    isPretest?: boolean;
    orderIndex: number;
  }[];
  for (const [idx, pair] of ordered) {
    const cfg = configByIndex.get(idx);
    const inputUri = await storeTextAsset("inputs", pair.input ?? "");
    const outputUri = await storeTextAsset("outputs", pair.output ?? "");
    rows.push({
      versionId: version.id,
      inputUri,
      outputUri,
      score: cfg?.score ?? 100,
      timeLimitMs: cfg?.timeLimitMs,
      memoryLimitKb: cfg?.memoryLimitKb,
      subtaskId: cfg?.subtaskId,
      isPretest: cfg?.isPretest ?? false,
      orderIndex: idx,
    });
  }

  await db.$transaction([
    db.testcase.deleteMany({ where: { versionId: version.id } }),
    db.testcase.createMany({ data: rows }),
  ]);

  try {
    const hustojProblemId = await syncHustojProblem(problemId);
    return NextResponse.json({
      ok: true,
      versionId: version.id,
      count: rows.length,
      sync: { ok: true, hustojProblemId },
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    const syncError = err instanceof Error ? err.message : String(err);
    try {
      const rollbackOps = [db.testcase.deleteMany({ where: { versionId: version.id } })];
      if (rollbackRows.length) {
        rollbackOps.push(db.testcase.createMany({ data: rollbackRows }));
      }
      await db.$transaction(rollbackOps);
    } catch (rollbackErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "hustoj_sync_failed",
          detail: syncError,
          rollback: "failed",
          rollbackError:
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
          sync: { ok: false, error: syncError },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "hustoj_sync_failed",
        detail: syncError,
        rollback: "ok",
        sync: { ok: false, error: syncError },
      },
      { status: 500 }
    );
  }
}, { roles: "admin" });
