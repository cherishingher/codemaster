import { db } from "@/lib/db";
import { storeTextAsset } from "@/lib/storage";
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

export const MAX_TESTCASE_ZIP_BYTES = readLimit(
  process.env.MAX_TESTCASE_ZIP_BYTES,
  DEFAULT_MAX_ZIP_BYTES
);
export const MAX_TESTCASE_FILE_BYTES = readLimit(
  process.env.MAX_TESTCASE_FILE_BYTES,
  DEFAULT_MAX_TESTCASE_BYTES
);
export const MAX_TESTCASE_COUNT = readLimit(
  process.env.MAX_TESTCASE_COUNT,
  DEFAULT_MAX_TESTCASE_COUNT
);

type Pair = { input?: string; output?: string };
type CaseConfig = {
  timeLimitMs?: number;
  memoryLimitKb?: number;
  score?: number;
  isPretest?: boolean;
  subtaskId?: number;
  isSample?: boolean;
  visible?: boolean;
  caseType?: number;
  groupId?: string;
  title?: string;
  orderIndex?: number;
};

export type TestcaseZipWarning = {
  code: string;
  detail?: unknown;
};

export class TestcaseZipError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "testcase_zip_error");
    this.status = status;
    this.body = body;
  }
}

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
      case "isSample":
        if (typeof value === "boolean") cfg.isSample = value;
        break;
      case "visible":
        if (typeof value === "boolean") cfg.visible = value;
        break;
      case "caseType":
        if (typeof value === "number") cfg.caseType = value;
        break;
      case "groupId":
        if (typeof value === "string" && value.trim()) cfg.groupId = value.trim();
        break;
      case "title":
        if (typeof value === "string" && value.trim()) cfg.title = value.trim();
        break;
      case "orderIndex":
        if (typeof value === "number") cfg.orderIndex = value;
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

export function normalizeZipEntryName(entryPath: string) {
  return entryPath.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function normalizeZipEntries(rawEntries: Map<string, Buffer>) {
  const entries = new Map<string, Buffer>();
  for (const [entryPath, data] of rawEntries.entries()) {
    const normalized = normalizeZipEntryName(entryPath);
    if (!normalized) continue;
    entries.set(normalized, data);
  }
  return entries;
}

function parseTestcaseEntries(entries: Map<string, Buffer>) {
  const warnings: TestcaseZipWarning[] = [];
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
    if (data.length > MAX_TESTCASE_FILE_BYTES) {
      throw new TestcaseZipError(400, {
        error: "entry_too_large",
        detail: { path: name, size: data.length, limit: MAX_TESTCASE_FILE_BYTES },
      });
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
    throw new TestcaseZipError(400, { error: "invalid_case_filename", detail: invalidCaseNames });
  }

  if (duplicateCaseFiles.length) {
    throw new TestcaseZipError(400, { error: "duplicate_case_files", detail: duplicateCaseFiles });
  }

  if (
    pairs.size > MAX_TESTCASE_COUNT ||
    inputFiles.size > MAX_TESTCASE_COUNT ||
    outputFiles.size > MAX_TESTCASE_COUNT
  ) {
    throw new TestcaseZipError(400, {
      error: "testcase_count_limit",
      detail: {
        limit: MAX_TESTCASE_COUNT,
        inputs: inputFiles.size,
        outputs: outputFiles.size,
      },
    });
  }

  if (!pairs.size) {
    throw new TestcaseZipError(400, { error: "no_testcases_found" });
  }

  let configByIndex = new Map<number, CaseConfig>();
  const configNameByIndex = new Map<number, string>();
  const duplicateConfigEntries: string[] = [];
  const configEntry =
    entries.get("config.yml") ??
    entries.get("config.yaml") ??
    Array.from(entries.entries()).find(([entryPath]) => {
      const base = entryPath.split("/").pop() || entryPath;
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
      throw new TestcaseZipError(400, { error: "config_unknown_inputs", detail: unknown });
    }
    if (duplicateConfigEntries.length) {
      throw new TestcaseZipError(400, {
        error: "duplicate_config_entries",
        detail: duplicateConfigEntries,
      });
    }
    const missingCases: number[] = [];
    for (const idx of configByIndex.keys()) {
      if (!pairs.has(idx)) missingCases.push(idx);
    }
    if (missingCases.length) {
      throw new TestcaseZipError(400, { error: "config_missing_cases", detail: missingCases });
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
      if (cfg.caseType !== undefined && ![0, 1, 2].includes(cfg.caseType)) {
        invalidConfig.push({ name, field: "caseType", value: cfg.caseType });
      }
      if (cfg.orderIndex !== undefined && !isValidInt(cfg.orderIndex, 1)) {
        invalidConfig.push({ name, field: "orderIndex", value: cfg.orderIndex });
      }
    }
    if (invalidConfig.length) {
      throw new TestcaseZipError(400, {
        error: "invalid_config_values",
        detail: invalidConfig,
      });
    }
  }

  const missing: number[] = [];
  const ordered = Array.from(pairs.entries()).sort((a, b) => a[0] - b[0]);
  for (const [idx, pair] of ordered) {
    if (!pair.input || !pair.output) missing.push(idx);
  }
  if (missing.length) {
    throw new TestcaseZipError(400, { error: "missing_pairs", detail: missing });
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

  return {
    ordered,
    warnings,
    configByIndex,
  };
}

export async function replaceProblemTestcasesFromEntries(
  problemId: string,
  entries: Map<string, Buffer>,
  options?: { skipSync?: boolean }
) {
  const { ordered, warnings, configByIndex } = parseTestcaseEntries(entries);
  const version = await db.problemVersion.findFirst({
    where: { problemId },
    orderBy: { version: "desc" },
  });
  if (!version) {
    throw new TestcaseZipError(404, { error: "version_not_found" });
  }

  const previousRows = await db.testcase.findMany({ where: { versionId: version.id } });
  const rollbackRows = previousRows.map(({ id, createdAt, updatedAt, ...rest }) => rest);

  const rows: Array<{
    versionId: string;
    title?: string | null;
    caseType?: number;
    visible?: boolean;
    inputUri: string;
    outputUri: string;
    score: number;
    timeLimitMs?: number;
    memoryLimitKb?: number;
    subtaskId?: number;
    isPretest?: boolean;
    groupId?: string | null;
    isSample: boolean;
    orderIndex: number;
  }> = [];

  for (const [idx, pair] of ordered) {
    const cfg = configByIndex.get(idx);
    const inputUri = await storeTextAsset("inputs", pair.input ?? "");
    const outputUri = await storeTextAsset("outputs", pair.output ?? "");
    const isSample = cfg?.isSample ?? cfg?.caseType === 0;
    const caseType = cfg?.caseType ?? (isSample ? 0 : 1);
    const visible = cfg?.visible ?? isSample;
    rows.push({
      versionId: version.id,
      title: cfg?.title ?? null,
      caseType,
      visible,
      inputUri,
      outputUri,
      score: cfg?.score ?? 100,
      timeLimitMs: cfg?.timeLimitMs,
      memoryLimitKb: cfg?.memoryLimitKb,
      subtaskId: cfg?.subtaskId,
      isPretest: cfg?.isPretest ?? false,
      groupId: cfg?.groupId,
      isSample,
      orderIndex: cfg?.orderIndex ?? idx,
    });
  }

  await db.$transaction([
    db.testcase.deleteMany({ where: { versionId: version.id } }),
    db.testcase.createMany({ data: rows }),
  ]);

  if (options?.skipSync) {
    return {
      ok: true as const,
      versionId: version.id,
      count: rows.length,
      sync: { ok: true as const, skipped: true as const },
      warnings: warnings.length ? warnings : undefined,
    };
  }

  try {
    const hustojProblemId = await syncHustojProblem(problemId);
    return {
      ok: true as const,
      versionId: version.id,
      count: rows.length,
      sync: { ok: true as const, hustojProblemId },
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err) {
    const syncError = err instanceof Error ? err.message : String(err);
    try {
      const rollbackOps = [db.testcase.deleteMany({ where: { versionId: version.id } })];
      if (rollbackRows.length) {
        rollbackOps.push(db.testcase.createMany({ data: rollbackRows }));
      }
      await db.$transaction(rollbackOps);
    } catch (rollbackErr) {
      throw new TestcaseZipError(500, {
        ok: false,
        error: "hustoj_sync_failed",
        detail: syncError,
        rollback: "failed",
        rollbackError: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        sync: { ok: false, error: syncError },
      });
    }

    throw new TestcaseZipError(500, {
      ok: false,
      error: "hustoj_sync_failed",
      detail: syncError,
      rollback: "ok",
      sync: { ok: false, error: syncError },
    });
  }
}

export function stripSharedRootFolder(entries: Map<string, Buffer>) {
  const paths = Array.from(entries.keys());
  const firstSegments = new Set(paths.map((entryPath) => entryPath.split("/")[0]));
  const allNested = paths.every((entryPath) => entryPath.includes("/"));
  if (!allNested || firstSegments.size !== 1) {
    return entries;
  }
  const stripped = new Map<string, Buffer>();
  let stillNestedCount = 0;
  for (const [entryPath, data] of entries.entries()) {
    const slashIndex = entryPath.indexOf("/");
    const next = entryPath.slice(slashIndex + 1);
    if (!next) continue;
    if (next.includes("/")) stillNestedCount += 1;
    stripped.set(next, data);
  }
  return stillNestedCount === stripped.size ? stripped : entries;
}
