import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { ensureHustojUser, submitToHustoj } from "@/lib/hustoj";
import { applyJudgeResult } from "@/lib/judge-stats";
import { judgeScratchProject, scoreScratchProject, type ScratchRuleSet, type ScratchScoreRuleSet } from "@/lib/scratch-judge";
import { readZipEntries } from "@/lib/zip";

export const runtime = "nodejs";

const SubmitSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1),
});

export const POST = withAuth(async (req, { params }, user) => {
  const payload = SubmitSchema.parse(await req.json());
  const resolvedParams = await Promise.resolve(params);
  const rawId = (resolvedParams as { id?: string | string[] } | undefined)?.id;
  const problemId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!problemId) {
    return NextResponse.json({ error: "problem_id_required" }, { status: 400 });
  }

  const latestVersion = await db.problemVersion.findFirst({
    where: { problemId },
    orderBy: { version: "desc" },
    include: { testcases: true },
  });

  if (!latestVersion) {
    return NextResponse.json({ error: "problem_version_not_found" }, { status: 404 });
  }

  if (isScratchLanguage(payload.language)) {
    if (!latestVersion.scratchRules) {
      return NextResponse.json({ error: "scratch_rules_not_configured" }, { status: 400 });
    }

    const project = await parseScratchProject(payload.code);
    if (!project) {
      return NextResponse.json({ error: "scratch_project_invalid" }, { status: 400 });
    }

    const submission = await db.submission.create({
      data: {
        userId: user.id,
        problemId,
        problemVersionId: latestVersion.id,
        lang: payload.language,
        code: payload.code,
        status: "RUNNING",
        judgeBackend: "scratch",
      },
    });

    const rawRules = latestVersion.scratchRules as ScratchRuleSet | ScratchScoreRuleSet;
    let status = "WA";
    let score = 0;
    if (rawRules && "rules" in rawRules && Array.isArray(rawRules.rules)) {
      const scored = scoreScratchProject(project, rawRules as ScratchScoreRuleSet);
      score = scored.score;
      status = scored.total > 0 && scored.score >= scored.total ? "AC" : "WA";
    } else {
      const result = judgeScratchProject(project, rawRules as ScratchRuleSet);
      status = result.ok ? "AC" : "WA";
      score = result.ok ? 100 : 0;
    }
    await applyJudgeResult({ submissionId: submission.id, status, score });
    return NextResponse.json({ submissionId: submission.id, status });
  }

  const hustojUser = await ensureHustojUser({ id: user.id, email: user.email, name: user.name });

  const submission = await db.submission.create({
    data: {
      userId: user.id,
      problemId,
      problemVersionId: latestVersion.id,
      lang: payload.language,
      code: payload.code,
      status: "QUEUED",
      judgeBackend: "hustoj",
    },
  });

  let hustoj;
  try {
    hustoj = await submitToHustoj({
      problemId,
      userId: hustojUser.hustojUserId,
      nick: hustojUser.nick,
      code: payload.code,
      language: payload.language,
    });
  } catch (err) {
    await db.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: "hustoj_submit_failed", detail: String(err) },
      { status: 400 }
    );
  }

  await db.submission.update({
    where: { id: submission.id },
    data: { hustojSolutionId: hustoj.solutionId },
  });

  return NextResponse.json({ submissionId: submission.id, status: submission.status });
});

function isScratchLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return normalized === "sb3" || normalized.startsWith("scratch");
}

async function parseScratchProject(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.targets)) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  const base64 = trimmed.startsWith("data:")
    ? trimmed.slice(trimmed.indexOf(",") + 1)
    : trimmed;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return null;
  }

  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return null;
  }

  const entries = await readZipEntries(buffer);
  const projectEntry = entries.get("project.json") ?? [...entries.entries()].find(([name]) => name.endsWith("/project.json"))?.[1];
  if (!projectEntry) return null;

  try {
    const parsed = JSON.parse(projectEntry.toString("utf8"));
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.targets)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
