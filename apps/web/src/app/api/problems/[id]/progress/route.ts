import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (_req, { params }, user) => {
  const progress = await db.userProblemProgress.findUnique({
    where: { userId_problemId: { userId: user.id, problemId: params.id } },
  });

  return NextResponse.json(
    progress ?? {
      userId: user.id,
      problemId: params.id,
      attempts: 0,
      bestScore: 0,
      lastStatus: null,
      solvedAt: null,
      lastSubmissionId: null,
    }
  );
});
