import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { ensureHustojUser, submitToHustoj } from "@/lib/hustoj";
import { applyJudgeResult } from "@/lib/judge-stats";
import {
  evaluateScratchProject,
  isSupportedScratchRuleSet,
  type ScratchAnyRuleSet,
} from "@/lib/scratch-judge";
import { parseScratchProjectCode } from "@/lib/scratch-project";
import {
  getLanguageId,
  isScratchLanguage,
  ProblemLifecycleStatus,
  toSubmissionJudgeResult,
} from "@/lib/oj";

export const runtime = "nodejs";

const SubmitSchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1),
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

    const project = await parseScratchProjectCode(payload.code);
    if (!project) {
      return NextResponse.json({ error: "scratch_project_invalid" }, { status: 400 });
    }

    const rawRules = currentVersion.scratchRules as ScratchAnyRuleSet;
    if (!isSupportedScratchRuleSet(rawRules)) {
      return NextResponse.json({ error: "scratch_rules_incomplete" }, { status: 400 });
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

    const evaluated = evaluateScratchProject(project, rawRules);
    await applyJudgeResult({
      submissionId: submission.id,
      status: evaluated.status,
      score: evaluated.score,
    });
    return NextResponse.json({ submissionId: submission.id, status: evaluated.status });
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
    const detail = String(err);
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
        stderrPreview: detail,
        checkerMessage: "hustoj_submit_failed",
      },
      create: {
        submissionId: submission.id,
        stderrPreview: detail,
        checkerMessage: "hustoj_submit_failed",
      },
    });
    return NextResponse.json(
      { error: "hustoj_submit_failed", detail },
      { status: 400 }
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
