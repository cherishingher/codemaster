import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { buildProblemIdentifierWhere } from "@/lib/problem-identifiers";
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

function jsonError(error: string, status: number, message?: string, detail?: string) {
  return NextResponse.json(
    {
      error,
      ...(message ? { message } : {}),
      ...(detail ? { detail } : {}),
    },
    { status }
  );
}

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
    return jsonError("problem_id_required", 400, "缺少题目标识，无法提交。");
  }

  const problem = await db.problem.findFirst({
    where: buildProblemIdentifierWhere(idOrSlug),
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
    return jsonError("problem_not_found", 404, "题目不存在或当前不可见。");
  }

  const canAccess =
    (problem.visible &&
      problem.defunct === "N" &&
      problem.status >= ProblemLifecycleStatus.PUBLISHED &&
      (problem.visibility === "public" || problem.visibility === "contest")) ||
    user.roles.includes("admin");
  if (!canAccess) {
    return jsonError("problem_not_found", 404, "题目不存在或当前不可见。");
  }

  const currentVersion = problem.currentVersion ?? problem.versions[0];
  if (!currentVersion) {
    return jsonError("problem_version_not_found", 404, "题目当前没有可用版本，暂时不能提交。");
  }

  const languageId = getLanguageId(payload.language);

  if (isScratchLanguage(payload.language)) {
    if (!currentVersion.scratchRules) {
      return jsonError(
        "scratch_rules_not_configured",
        400,
        "当前 Scratch 题还没有配置评测规则，暂时不能提交。"
      );
    }

    const project = await parseScratchProjectCode(payload.code);
    if (!project) {
      return jsonError(
        "scratch_project_invalid",
        400,
        "Scratch 项目文件无效，请重新导入后再提交。"
      );
    }

    const rawRules = currentVersion.scratchRules as ScratchAnyRuleSet;
    if (!isSupportedScratchRuleSet(rawRules)) {
      return jsonError(
        "scratch_rules_incomplete",
        400,
        "当前 Scratch 评测规则不完整，暂时不能提交。"
      );
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
    return jsonError(
      "testcases_not_configured",
      400,
      "当前题目还没有配置测试点，暂时不能提交。"
    );
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
      return jsonError(
        "judge_queue_failed",
        503,
        "评测任务入队失败，请稍后重试。",
        detail
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
    return jsonError(
      "hustoj_submit_failed",
      400,
      "提交到评测机失败，请稍后重试。",
      detail
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
