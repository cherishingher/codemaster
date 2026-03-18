import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { ensureHustojUser, submitToHustoj } from "@/lib/hustoj";
import { applyJudgeResult } from "@/lib/judge-stats";
import { pushJudgeJob } from "@/lib/queue";
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

function sortVersionTestcases(
  testcases: Array<{
    id: string;
    inputUri: string;
    outputUri: string;
    score: number;
    orderIndex: number | null;
  }>
) {
  return [...testcases].sort((a, b) => {
    const ao = a.orderIndex ?? Number.MAX_SAFE_INTEGER;
    const bo = b.orderIndex ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

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

    const evaluated = evaluateScratchProject(
      project as Parameters<typeof evaluateScratchProject>[0],
      rawRules
    );
    await applyJudgeResult({
      submissionId: submission.id,
      status: evaluated.status,
      score: evaluated.score,
    });
    return NextResponse.json({ submissionId: submission.id, status: evaluated.status });
  }

  const versionTestcases = sortVersionTestcases(
    currentVersion.testcases.map((item) => ({
      id: item.id,
      inputUri: item.inputUri,
      outputUri: item.outputUri,
      score: item.score,
      orderIndex: item.orderIndex ?? null,
    }))
  );

  if (versionTestcases.length === 0) {
    return NextResponse.json({ error: "testcases_not_configured" }, { status: 400 });
  }

  if (process.env.ENABLE_LOCAL_RUNNER === "true") {
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
        judgeBackend: "local",
        sourceCode: {
          create: {
            source: payload.code,
            storageType: "inline",
            sourceSize: Buffer.byteLength(payload.code, "utf8"),
          },
        },
      },
    });

    try {
      await pushJudgeJob({
        jobId: `submission:${submission.id}`,
        submissionId: submission.id,
        problemId: problem.id,
        problemVersionId: currentVersion.id,
        language: payload.language,
        code: payload.code,
        timeLimitMs: currentVersion.timeLimitMs,
        memoryLimitMb: currentVersion.memoryLimitMb,
        testcases: versionTestcases.map((item) => ({
          testcaseId: item.id,
          inputUri: item.inputUri,
          outputUri: item.outputUri,
          score: item.score,
        })),
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
          checkerMessage: "judge_queue_failed",
        },
        create: {
          submissionId: submission.id,
          stderrPreview: detail,
          checkerMessage: "judge_queue_failed",
        },
      });
      return NextResponse.json(
        { error: "judge_queue_failed", detail },
        { status: 503 }
      );
    }

    return NextResponse.json({ submissionId: submission.id, status: submission.status });
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
