import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { ensureHustojUser, submitToHustoj } from "@/lib/hustoj";
import { applyJudgeResult } from "@/lib/judge-stats";
import {
  judgeScratchProject,
  scoreScratchProject,
  type ScratchRuleSet,
  type ScratchScoreRuleSet,
} from "@/lib/scratch-judge";
import { readZipEntries } from "@/lib/zip";
import {
  getLanguageId,
  isScratchLanguage,
  ProblemLifecycleStatus,
  toSubmissionJudgeResult,
} from "@/lib/oj";

export const runtime = "nodejs";

const MAX_CODE_LENGTH = 65536;

const SubmitSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(MAX_CODE_LENGTH, "代码长度超过限制"),
});

export const POST = withAuth(async (req, { params }, user) => {
  const payload = SubmitSchema.parse(await req.json());
  const resolvedParams = await Promise.resolve(params);
  const rawId = (resolvedParams as { id?: string | string[] } | undefined)?.id;
  const idOrSlug = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!idOrSlug) {
    return NextResponse.json({ error: "problem_id_required" }, { status: 400 });
  }

  const problem = await db.problem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      currentVersion: {
        include: { testcases: true },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { testcases: true },
      },
    },
  });
  if (!problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  const canAccess =
    (problem.visible &&
      problem.defunct === "N" &&
      problem.status >= ProblemLifecycleStatus.PUBLISHED &&
      (problem.visibility === "public" || problem.visibility === "contest")) ||
    user.roles.includes("admin");
  if (!canAccess) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  const currentVersion = problem.currentVersion ?? problem.versions[0];
  if (!currentVersion) {
    return NextResponse.json({ error: "problem_version_not_found" }, { status: 404 });
  }

  const languageId = getLanguageId(payload.language);

  if (isScratchLanguage(payload.language)) {
    if (!currentVersion.scratchRules) {
      return NextResponse.json({ error: "scratch_rules_not_configured" }, { status: 400 });
    }

    const project = await parseScratchProject(payload.code);
    if (!project) {
      return NextResponse.json({ error: "scratch_project_invalid" }, { status: 400 });
    }

    const submission = await db.submission.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        problemVersionId: currentVersion.id,
        lang: payload.language,
        languageId,
        code: payload.code,
        status: "RUNNING",
        judgeResult: toSubmissionJudgeResult("RUNNING"),
        judgeBackend: "scratch",
        sourceCode: {
          create: {
            source: payload.code,
            storageType: "inline",
            sourceSize: Buffer.byteLength(payload.code, "utf8"),
          },
        },
      },
    });

    const rawRules = currentVersion.scratchRules as ScratchRuleSet | ScratchScoreRuleSet;
    let status = "WA";
    let score = 0;
    if (rawRules && "rules" in rawRules && Array.isArray(rawRules.rules)) {
      const scored = scoreScratchProject(project, rawRules as ScratchScoreRuleSet);
      score = scored.score;
      const totalRules = rawRules.rules.length;
      const allRulesPassed = totalRules > 0 && scored.passed >= totalRules;
      const hasPartialPass = scored.passed > 0 || scored.score > 0;
      status = allRulesPassed ? "AC" : hasPartialPass ? "PARTIAL" : "WA";
    } else {
      const result = judgeScratchProject(project, rawRules as ScratchRuleSet);
      status = result.ok ? "AC" : "WA";
      score = result.ok ? 100 : 0;
    }
    await applyJudgeResult({ submissionId: submission.id, status, score });
    return NextResponse.json({ submissionId: submission.id, status });
  }

  const hustojUser = await ensureHustojUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const submission = await db.submission.create({
    data: {
      userId: user.id,
      problemId: problem.id,
      problemVersionId: currentVersion.id,
      lang: payload.language,
      languageId,
      code: payload.code,
      status: "QUEUED",
      judgeResult: toSubmissionJudgeResult("QUEUED"),
      judgeBackend: "hustoj",
      sourceCode: {
        create: {
          source: payload.code,
          storageType: "inline",
          sourceSize: Buffer.byteLength(payload.code, "utf8"),
        },
      },
    },
  });

  let hustoj;
  try {
    hustoj = await submitToHustoj({
      problemId: problem.id,
      userId: hustojUser.hustojUserId,
      nick: hustojUser.nick,
      code: payload.code,
      language: payload.language,
    });
  } catch (err) {
    console.error("[submit] hustoj submission failed", err);
    await db.submission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        judgeResult: toSubmissionJudgeResult("FAILED"),
        finishedAt: new Date(),
      },
    });
    await db.runtimeInfo.upsert({
      where: { submissionId: submission.id },
      update: {
        stderrPreview: String(err),
        checkerMessage: "hustoj_submit_failed",
      },
      create: {
        submissionId: submission.id,
        stderrPreview: String(err),
        checkerMessage: "hustoj_submit_failed",
      },
    });
    return NextResponse.json(
      { error: "judge_submit_failed", message: "提交到评测系统失败，请稍后重试" },
      { status: 502 }
    );
  }

  await db.submission.update({
    where: { id: submission.id },
    data: {
      hustojSolutionId: hustoj.solutionId,
      languageId: hustoj.langId,
    },
  });

  return NextResponse.json({ submissionId: submission.id, status: submission.status });
});

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
  const projectEntry =
    entries.get("project.json") ??
    [...entries.entries()].find(([name]) => name.endsWith("/project.json"))?.[1];
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
