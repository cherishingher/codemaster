import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { readZipEntries } from "@/lib/zip";
import { generateScratchRuleSet } from "@/lib/scratch-rules-gen";
import { load as loadYaml } from "js-yaml";
import { Prisma } from "@prisma/client";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const CONFIG_FILE_NAMES = new Set(["config.yml", "config.yaml", "config.json"]);

type ScratchBatchConfigItem = {
  file: string;
  score?: number;
  role?: string;
};

type ScratchBatchConfig = {
  role?: string;
  mode?: "append" | "replace";
  defaultScore?: number;
  scores?: Record<string, number>;
  items?: ScratchBatchConfigItem[];
};

type ScratchRuleItem = {
  score: number;
  rule: ReturnType<typeof generateScratchRuleSet>;
};

function normalizeName(filePath: string) {
  return filePath.replace(/^\/+/, "").replace(/\\/g, "/");
}

async function parseScratchProjectBuffer(name: string, buffer: Buffer) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".sb3")) {
    const entries = await readZipEntries(buffer);
    let project: Buffer | undefined;
    for (const [entryPath, data] of entries.entries()) {
      const normalized = normalizeName(entryPath);
      if ((normalized.split("/").pop() || normalized) === "project.json") {
        project = data;
        break;
      }
    }
    if (!project) {
      throw new Error("project_json_not_found");
    }
    return JSON.parse(project.toString("utf8"));
  }

  if (lowerName.endsWith(".json")) {
    return JSON.parse(buffer.toString("utf8"));
  }

  throw new Error("unsupported_file_type");
}

async function parseScratchProject(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseScratchProjectBuffer(file.name || "", buffer);
}

function toNonNegativeInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function resolveBatchMode(mode: unknown, fallback: "append" | "replace") {
  return mode === "append" || mode === "replace" ? mode : fallback;
}

function isScratchProjectName(path: string) {
  const normalized = normalizeName(path);
  const lower = normalized.toLowerCase();
  const base = lower.split("/").pop() || lower;
  if (CONFIG_FILE_NAMES.has(base)) return false;
  return lower.endsWith(".sb3") || lower.endsWith(".json");
}

function inferScoreFromFileName(path: string) {
  const base = (normalizeName(path).split("/").pop() || "").toLowerCase();
  const stem = base.replace(/\.(sb3|json)$/, "");
  const patterns = [/^(\d+)[-_]/, /[-_](\d+)$/, /@(\d+)$/, /(\d+)分$/];
  for (const pattern of patterns) {
    const hit = stem.match(pattern);
    if (hit?.[1]) return Number(hit[1]);
  }
  return undefined;
}

function resolveItemPath(targetPath: string, candidates: string[]) {
  const normalizedTarget = normalizeName(targetPath);
  if (candidates.includes(normalizedTarget)) return normalizedTarget;

  const targetBase = normalizedTarget.split("/").pop();
  if (!targetBase) return null;
  const baseMatches = candidates.filter((entry) => entry.split("/").pop() === targetBase);
  if (baseMatches.length === 1) return baseMatches[0];
  return null;
}

function parseBatchConfig(entries: Map<string, Buffer>) {
  const configEntry = [...entries.entries()].find(([path]) =>
    CONFIG_FILE_NAMES.has((normalizeName(path).split("/").pop() || "").toLowerCase())
  );
  if (!configEntry) return {} as ScratchBatchConfig;

  const [path, data] = configEntry;
  const lower = path.toLowerCase();
  const raw = data.toString("utf8");

  let parsed: unknown;
  try {
    if (lower.endsWith(".json")) {
      parsed = JSON.parse(raw);
    } else {
      parsed = loadYaml(raw);
    }
  } catch {
    throw new Error("scratch_config_parse_failed");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("scratch_config_invalid");
  }

  return parsed as ScratchBatchConfig;
}

function readScoreFromMap(path: string, scores: Record<string, number> | undefined) {
  if (!scores || typeof scores !== "object") return undefined;
  const normalized = normalizeName(path);
  const base = normalized.split("/").pop() || normalized;
  const mapped = scores[normalized] ?? scores[base];
  if (!Number.isFinite(mapped)) return undefined;
  return Math.max(0, Math.floor(Number(mapped)));
}

function mergeScratchRuleSets(
  existingRaw: unknown,
  incoming: { role: string; rules: ScratchRuleItem[]; totalScore: number },
  mode: "append" | "replace"
) {
  if (
    mode !== "append" ||
    !existingRaw ||
    typeof existingRaw !== "object" ||
    !Array.isArray((existingRaw as { rules?: unknown[] }).rules)
  ) {
    return incoming;
  }

  const existing = existingRaw as { role?: unknown; rules: Array<{ score?: unknown }> };
  const existingRole = typeof existing.role === "string" ? existing.role : incoming.role;
  if (existingRole && existingRole !== incoming.role) {
    throw new Error("scratch_role_conflict_with_existing_rules");
  }

  const mergedRules = [...existing.rules, ...incoming.rules];
  const totalScore = mergedRules.reduce<number>(
    (sum, item) => sum + (Number(item?.score) || 0),
    0
  );

  return {
    role: existingRole ?? incoming.role,
    rules: mergedRules,
    totalScore,
  };
}

export const POST = withAuth(
  async (req, { params }) => {
    const form = await req.formData();
    const file = form.get("answer");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "answer_file_required" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "answer_file_empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "answer_file_too_large", detail: { size: file.size, limit: MAX_FILE_BYTES } },
        { status: 400 }
      );
    }

    const problemId = params.id;
    const versionIdRaw = form.get("versionId");
    const roleRaw = form.get("role");
    const scoreRaw = form.get("score");
    const modeRaw = form.get("mode");
    const versionId = typeof versionIdRaw === "string" && versionIdRaw ? versionIdRaw : undefined;
    const role = typeof roleRaw === "string" && roleRaw ? roleRaw.trim() : undefined;
    const score = typeof scoreRaw === "string" ? Number(scoreRaw) : undefined;
    const mode = resolveBatchMode(modeRaw, "replace");
    const defaultItemScore = toNonNegativeInt(score, 10);

    const version = versionId
      ? await db.problemVersion.findUnique({ where: { id: versionId } })
      : await db.problemVersion.findFirst({
          where: { problemId },
          orderBy: { version: "desc" },
        });
    if (!version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 });
    }

    let effectiveMode = mode;
    let nextRules: unknown;
    let resultMeta: Record<string, unknown>;

    if ((file.name || "").toLowerCase().endsWith(".zip")) {
      let entriesRaw: Map<string, Buffer>;
      try {
        entriesRaw = await readZipEntries(Buffer.from(await file.arrayBuffer()));
      } catch {
        return NextResponse.json({ error: "scratch_batch_zip_parse_failed" }, { status: 400 });
      }

      const entries = new Map<string, Buffer>();
      for (const [entryPath, data] of entriesRaw.entries()) {
        const normalized = normalizeName(entryPath);
        if (!entries.has(normalized)) {
          entries.set(normalized, data);
        }
      }

      let batchConfig: ScratchBatchConfig;
      try {
        batchConfig = parseBatchConfig(entries);
      } catch (err) {
        const message = err instanceof Error ? err.message : "scratch_config_invalid";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      effectiveMode = resolveBatchMode(batchConfig.mode, mode);
      const configRole =
        typeof batchConfig.role === "string" && batchConfig.role.trim()
          ? batchConfig.role.trim()
          : undefined;
      const batchDefaultScore = toNonNegativeInt(batchConfig.defaultScore, defaultItemScore);
      const candidates = [...entries.keys()].filter(isScratchProjectName).sort();
      if (!candidates.length) {
        return NextResponse.json({ error: "scratch_batch_no_project_files" }, { status: 400 });
      }

      const plannedItems: Array<{ path: string; score: number; role?: string }> = [];
      const configuredItems = Array.isArray(batchConfig.items) ? batchConfig.items : [];

      if (configuredItems.length) {
        for (const item of configuredItems) {
          if (!item || typeof item !== "object" || typeof item.file !== "string") {
            return NextResponse.json({ error: "scratch_batch_item_invalid" }, { status: 400 });
          }
          const resolvedPath = resolveItemPath(item.file, candidates);
          if (!resolvedPath) {
            return NextResponse.json(
              { error: "scratch_batch_item_not_found", detail: { file: item.file } },
              { status: 400 }
            );
          }

          const explicit = Number(item.score);
          const scoreFromMap = readScoreFromMap(resolvedPath, batchConfig.scores);
          const inferred = inferScoreFromFileName(resolvedPath);
          const finalScore = Number.isFinite(explicit)
            ? Math.max(0, Math.floor(explicit))
            : scoreFromMap ?? inferred ?? batchDefaultScore;
          const itemRole =
            typeof item.role === "string" && item.role.trim() ? item.role.trim() : undefined;

          plannedItems.push({
            path: resolvedPath,
            score: finalScore,
            role: itemRole ?? configRole ?? role,
          });
        }
      } else {
        for (const path of candidates) {
          const mapped = readScoreFromMap(path, batchConfig.scores);
          const inferred = inferScoreFromFileName(path);
          plannedItems.push({
            path,
            score: mapped ?? inferred ?? batchDefaultScore,
            role: configRole ?? role,
          });
        }
      }

      const generatedRules: ScratchRuleItem[] = [];
      for (const item of plannedItems) {
        const buffer = entries.get(item.path);
        if (!buffer) {
          return NextResponse.json(
            { error: "scratch_batch_item_not_found", detail: { file: item.path } },
            { status: 400 }
          );
        }

        let project: unknown;
        try {
          project = await parseScratchProjectBuffer(item.path, buffer);
        } catch (err) {
          const message = err instanceof Error ? err.message : "project_parse_failed";
          return NextResponse.json(
            { error: message, detail: { file: item.path } },
            { status: 400 }
          );
        }

        let rule;
        try {
          rule = generateScratchRuleSet(project as Parameters<typeof generateScratchRuleSet>[0], {
            role: item.role,
            substackMode: "unordered",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "rule_generation_failed";
          return NextResponse.json(
            { error: message, detail: { file: item.path } },
            { status: 400 }
          );
        }

        generatedRules.push({ score: item.score, rule });
      }

      const roleSet = new Set(generatedRules.map((item) => item.rule.role));
      if (roleSet.size !== 1) {
        return NextResponse.json({ error: "scratch_batch_role_mismatch" }, { status: 400 });
      }

      const batchRole = generatedRules[0].rule.role;
      const incoming = {
        role: batchRole,
        rules: generatedRules,
        totalScore: generatedRules.reduce((sum, item) => sum + item.score, 0),
      };
      try {
        nextRules = mergeScratchRuleSets(version.scratchRules, incoming, effectiveMode);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "scratch_role_conflict_with_existing_rules";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      resultMeta = {
        role: batchRole,
        scripts: generatedRules.reduce((sum, item) => sum + item.rule.scripts.length, 0),
        score: incoming.totalScore,
        totalScore: incoming.totalScore,
        imported: generatedRules.length,
        batch: true,
      };
    } else {
      let project: unknown;
      try {
        project = await parseScratchProject(file);
      } catch (err) {
        const message = err instanceof Error ? err.message : "project_parse_failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      let baseRule;
      try {
        baseRule = generateScratchRuleSet(project as Parameters<typeof generateScratchRuleSet>[0], {
          role,
          substackMode: "unordered",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "rule_generation_failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const incoming = {
        role: baseRule.role,
        rules: [{ score: defaultItemScore, rule: baseRule }],
        totalScore: defaultItemScore,
      };
      try {
        nextRules = mergeScratchRuleSets(version.scratchRules, incoming, effectiveMode);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "scratch_role_conflict_with_existing_rules";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      resultMeta = {
        role: baseRule.role,
        scripts: baseRule.scripts.length,
        score: defaultItemScore,
        totalScore: defaultItemScore,
        imported: 1,
        batch: false,
      };
    }

    await db.problemVersion.update({
      where: { id: version.id },
      data: { scratchRules: nextRules as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      ok: true,
      versionId: version.id,
      mode: effectiveMode,
      ...resultMeta,
    });
  },
  { roles: "admin" }
);
