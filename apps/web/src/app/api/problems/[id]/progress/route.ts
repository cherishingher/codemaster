import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { resolveProblemId } from "@/lib/problem-identifiers";

export const GET = withAuth(async (_req, { params }, user) => {
  const problemId = await resolveProblemId(params.id)
  const resolvedProblemId = problemId ?? params.id
  const progress = await db.userProblemProgress.findUnique({
    where: { userId_problemId: { userId: user.id, problemId: resolvedProblemId } },
  });

  return NextResponse.json(
    progress ?? {
      userId: user.id,
      problemId: resolvedProblemId,
      status: 0,
      attempts: 0,
      bestScore: 0,
      lastStatus: null,
      solvedAt: null,
      lastSubmissionId: null,
    }
  );
});
