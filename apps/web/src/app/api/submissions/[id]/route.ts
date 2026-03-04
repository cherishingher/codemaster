import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import {
  getHustojCompileInfo,
  getHustojResult,
  getHustojRuntimeInfo,
} from "@/lib/hustoj";
import { applyJudgeResult, mapJudgeStatus } from "@/lib/judge-stats";
import { getSubmissionErrorMessage, mapSubmissionStatusToUi } from "@/lib/oj";

export const runtime = "nodejs";

export const GET = withAuth(async (_req, { params }, user) => {
  let submission = await db.submission.findUnique({
    where: { id: params.id },
    include: {
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
      sourceCode: true,
      compileInfo: true,
      runtimeInfo: true,
      cases: {
        orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }],
        include: {
          testcase: {
            select: {
              id: true,
              title: true,
              caseType: true,
              isSample: true,
              visible: true,
              groupId: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (submission.userId !== user.id && !user.roles.includes("admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (submission.judgeBackend === "hustoj" && submission.hustojSolutionId) {
    const [result, compileMessage, runtimeMessage] = await Promise.all([
      getHustojResult(submission.hustojSolutionId),
      getHustojCompileInfo(submission.hustojSolutionId),
      getHustojRuntimeInfo(submission.hustojSolutionId),
    ]);

    if (result) {
      const mapped = mapJudgeStatus(result.result);
      const isFinal = ["AC", "WA", "TLE", "MLE", "RE", "CE", "PE", "OLE"].includes(mapped);
      const score = mapped === "AC" ? 100 : mapped === "PE" ? submission.score : 0;

      if (
        mapped !== submission.status ||
        compileMessage !== submission.compileInfo?.message ||
        runtimeMessage !== submission.runtimeInfo?.stderrPreview
      ) {
        if (isFinal) {
          await applyJudgeResult({
            submissionId: submission.id,
            status: mapped,
            score,
            maxTimeMs: result.time,
            maxMemoryMb: result.memory,
            compileMessage,
            runtimeMessage,
          });
        } else {
          await db.submission.update({
            where: { id: submission.id },
            data: {
              status: mapped,
              judgeResult: result.result,
              timeUsedMs: result.time ?? undefined,
              memoryUsedKb: result.memory ?? undefined,
            },
          });
          if (compileMessage) {
            await db.compileInfo.upsert({
              where: { submissionId: submission.id },
              update: { message: compileMessage },
              create: { submissionId: submission.id, message: compileMessage },
            });
          }
          if (runtimeMessage) {
            await db.runtimeInfo.upsert({
              where: { submissionId: submission.id },
              update: { stderrPreview: runtimeMessage, checkerMessage: mapped },
              create: {
                submissionId: submission.id,
                stderrPreview: runtimeMessage,
                checkerMessage: mapped,
              },
            });
          }
        }
        submission = await db.submission.findUnique({
          where: { id: params.id },
          include: {
            problem: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
            sourceCode: true,
            compileInfo: true,
            runtimeInfo: true,
            cases: {
              orderBy: [{ ordinal: "asc" }, { createdAt: "asc" }],
              include: {
                testcase: {
                  select: {
                    id: true,
                    title: true,
                    caseType: true,
                    isSample: true,
                    visible: true,
                    groupId: true,
                  },
                },
              },
            },
          },
        });
        if (!submission) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
      }
    }
  }

  const uiStatus = mapSubmissionStatusToUi(submission.status);
  const canSeeAllCaseMetadata = user.roles.includes("admin");
  const cases = submission.cases
    .filter((item) => {
      if (canSeeAllCaseMetadata) return true;
      return item.testcase?.isSample || item.testcase?.caseType === 0 || item.testcase?.visible;
    })
    .map((item) => ({
      id: item.id,
      testcaseId: item.testcaseId,
      ordinal: item.ordinal,
      status: item.status,
      judgeResult: item.judgeResult,
      timeMs: item.timeMs,
      memoryMb: item.memoryMb,
      score: item.score,
      testcase: item.testcase
        ? {
            id: item.testcase.id,
            title: item.testcase.title,
            caseType: item.testcase.caseType,
            groupId: item.testcase.groupId,
            isSample: item.testcase.isSample,
          }
        : null,
      inputPreview:
        canSeeAllCaseMetadata || item.testcase?.isSample || item.testcase?.caseType === 0
          ? item.inputPreview
          : null,
      outputPreview:
        canSeeAllCaseMetadata || item.testcase?.isSample || item.testcase?.caseType === 0
          ? item.outputPreview
          : null,
      expectedPreview:
        canSeeAllCaseMetadata || item.testcase?.isSample || item.testcase?.caseType === 0
          ? item.expectedPreview
          : null,
      checkerMessage: item.checkerMessage,
    }));

  return NextResponse.json({
    id: submission.id,
    status: uiStatus,
    rawStatus: submission.status,
    judgeResult: submission.judgeResult,
    score: submission.score,
    timeUsed: submission.timeUsedMs,
    memoryUsed: submission.memoryUsedKb,
    language: submission.lang,
    languageId: submission.languageId,
    judgeBackend: submission.judgeBackend,
    createdAt: submission.createdAt,
    finishedAt: submission.finishedAt,
    problem: submission.problem,
    sourceCode: submission.sourceCode
      ? {
          storageType: submission.sourceCode.storageType,
          source: submission.sourceCode.source,
          objectKey: submission.sourceCode.objectKey,
          sourceSize: submission.sourceCode.sourceSize,
        }
      : submission.code
        ? {
            storageType: "inline",
            source: submission.code,
            objectKey: null,
            sourceSize: submission.code.length,
          }
        : null,
    compileInfo: submission.compileInfo,
    runtimeInfo: submission.runtimeInfo,
    errorMessage: getSubmissionErrorMessage(submission),
    cases,
  });
});
