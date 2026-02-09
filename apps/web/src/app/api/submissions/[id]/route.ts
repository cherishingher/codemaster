import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { getHustojResult } from "@/lib/hustoj";
import { applyJudgeResult, mapJudgeStatus } from "@/lib/judge-stats";

export const runtime = "nodejs";

export const GET = withAuth(async (_req, { params }, user) => {
  const submission = await db.submission.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      judgeBackend: true,
      hustojSolutionId: true,
      status: true,
      score: true,
      createdAt: true,
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (submission.userId !== user.id && !user.roles.includes("admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let currentStatus = submission.status;
  let currentScore = submission.score;
  let timeUsed: number | undefined;
  let memoryUsed: number | undefined;

  if (submission.judgeBackend === "hustoj" && submission.hustojSolutionId) {
    const result = await getHustojResult(submission.hustojSolutionId);
    if (result) {
      timeUsed = result.time ?? undefined;
      memoryUsed = result.memory ?? undefined;
      const mapped = mapJudgeStatus(result.result);
      if (mapped !== submission.status) {
        const isFinal = ["AC", "WA", "TLE", "MLE", "RE", "CE", "PE", "OLE"].includes(mapped);
        if (isFinal) {
          const score = mapped === "AC" ? 100 : 0;
          currentScore = score;
          await applyJudgeResult({
            submissionId: submission.id,
            status: mapped,
            score,
            maxTimeMs: result.time,
            maxMemoryMb: result.memory,
          });
        } else {
          await db.submission.update({
            where: { id: submission.id },
            data: { status: mapped },
          });
        }
      }
      currentStatus = mapped;
    }
  }

  const uiStatus = mapToUiStatus(currentStatus);

  return NextResponse.json({
    id: submission.id,
    status: uiStatus,
    score: currentScore,
    timeUsed,
    memoryUsed,
    createdAt: submission.createdAt,
  });
});

function mapToUiStatus(status: string) {
  switch (status) {
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
      return "JUDGING";
    case "AC":
      return "ACCEPTED";
    case "WA":
      return "WRONG_ANSWER";
    case "TLE":
      return "TIME_LIMIT_EXCEEDED";
    case "MLE":
      return "MEMORY_LIMIT_EXCEEDED";
    case "RE":
      return "RUNTIME_ERROR";
    case "CE":
      return "COMPILE_ERROR";
    case "PE":
    case "OLE":
    case "UNKNOWN":
    case "FAILED":
      return "SYSTEM_ERROR";
    default:
      return status;
  }
}
