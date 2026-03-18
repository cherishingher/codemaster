import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { getContestPhase } from "@/lib/contest";
import { ensureHustojUser, submitToHustoj } from "@/lib/hustoj";
import { toSubmissionJudgeResult, getLanguageId } from "@/lib/oj";
import { rateLimit } from "@/lib/rate-limit";

const SubmitSchema = z.object({
  problemId: z.string().min(1),
  language: z.string().min(1),
  code: z.string().min(1).max(65536),
});

export const POST = withAuth(async (req, { params }, user) => {
  const { id: contestId } = params;
  const payload = SubmitSchema.parse(await req.json());

  const limit = rateLimit(`contest-submit:${user.id}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "too_many_submissions" }, { status: 429 });
  }

  const contest = await db.contest.findUnique({
    where: { id: contestId },
    include: { problems: true },
  });
  if (!contest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const phase = getContestPhase(contest);
  if (phase !== "running" && phase !== "frozen") {
    return NextResponse.json({ error: "contest_not_running", message: "比赛未在进行中" }, { status: 400 });
  }

  const participant = await db.contestParticipant.findUnique({
    where: { contestId_userId: { contestId, userId: user.id } },
  });
  if (!participant) {
    return NextResponse.json({ error: "not_registered", message: "未报名该比赛" }, { status: 403 });
  }

  const contestProblem = contest.problems.find((p) => p.problemId === payload.problemId);
  if (!contestProblem) {
    return NextResponse.json({ error: "problem_not_in_contest" }, { status: 400 });
  }

  const problem = await db.problem.findUnique({
    where: { id: payload.problemId },
    include: {
      currentVersion: true,
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  const version = problem.currentVersion ?? problem.versions[0];
  if (!version) {
    return NextResponse.json({ error: "no_version" }, { status: 400 });
  }

  const languageId = getLanguageId(payload.language);

  const hustojUser = await ensureHustojUser({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const submission = await db.submission.create({
    data: {
      userId: user.id,
      problemId: problem.id,
      problemVersionId: version.id,
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

  try {
    const hustoj = await submitToHustoj({
      problemId: problem.id,
      userId: hustojUser.hustojUserId,
      nick: hustojUser.nick,
      code: payload.code,
      language: payload.language,
    });

    await db.submission.update({
      where: { id: submission.id },
      data: { hustojSolutionId: hustoj.solutionId, languageId: hustoj.langId },
    });
  } catch (err) {
    console.error("[contest-submit] hustoj failed", err);
    await db.submission.update({
      where: { id: submission.id },
      data: { status: "FAILED", judgeResult: toSubmissionJudgeResult("FAILED"), finishedAt: new Date() },
    });
    return NextResponse.json({ error: "judge_submit_failed", message: "提交到评测系统失败" }, { status: 502 });
  }

  return NextResponse.json({ submissionId: submission.id });
});
