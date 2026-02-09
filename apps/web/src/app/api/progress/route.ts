import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (_req, _ctx, user) => {
  const rows = await db.userProblemProgress.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      problem: { select: { id: true, title: true, difficulty: true, source: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      problem: r.problem,
      attempts: r.attempts,
      bestScore: r.bestScore,
      lastStatus: r.lastStatus,
      solvedAt: r.solvedAt,
      lastSubmissionId: r.lastSubmissionId,
      updatedAt: r.updatedAt,
    }))
  );
});
