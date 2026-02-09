import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { readZipEntries } from "@/lib/zip";
import { generateScratchRuleSet } from "@/lib/scratch-rules-gen";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

function normalizeName(path: string) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

async function parseScratchProject(file: File) {
  const name = (file.name || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".sb3")) {
    const entries = await readZipEntries(buffer);
    let project: Buffer | undefined;
    for (const [path, data] of entries.entries()) {
      const normalized = normalizeName(path);
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

  if (name.endsWith(".json")) {
    return JSON.parse(buffer.toString("utf8"));
  }

  throw new Error("unsupported_file_type");
}

export const POST = withAuth(async (req, { params }) => {
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
  const mode = typeof modeRaw === "string" ? modeRaw : "replace";

  const version = versionId
    ? await db.problemVersion.findUnique({ where: { id: versionId } })
    : await db.problemVersion.findFirst({
        where: { problemId },
        orderBy: { version: "desc" },
      });
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  let project: unknown;
  try {
    project = await parseScratchProject(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "project_parse_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let baseRule;
  try {
    baseRule = generateScratchRuleSet(project as any, {
      role,
      substackMode: "unordered",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "rule_generation_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const itemScore = Number.isFinite(score) && score !== undefined ? Math.max(0, Math.floor(score)) : 10;

  let nextRules: any = {
    role: baseRule.role,
    rules: [{ score: itemScore, rule: baseRule }],
    totalScore: itemScore,
  };

  if (mode === "append" && version.scratchRules && typeof version.scratchRules === "object") {
    const existing = version.scratchRules as any;
    if (Array.isArray(existing.rules)) {
      const mergedRules = [...existing.rules, { score: itemScore, rule: baseRule }];
      const totalScore = mergedRules.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
      nextRules = {
        role: existing.role ?? baseRule.role,
        rules: mergedRules,
        totalScore,
      };
    }
  }

  await db.problemVersion.update({
    where: { id: version.id },
    data: { scratchRules: nextRules },
  });

  return NextResponse.json({
    ok: true,
    versionId: version.id,
    role: baseRule.role,
    scripts: baseRule.scripts.length,
    score: itemScore,
    mode,
  });
}, { roles: "admin" });
