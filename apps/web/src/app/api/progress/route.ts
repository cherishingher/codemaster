import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { jsonList } from "@/lib/api-response";

export const GET = withAuth(async (_req, _ctx, user) => {
  const rows = await db.userProblemProgress.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      problem: { select: { id: true, slug: true, title: true, difficulty: true, source: true } },
    },
  });

  const items = rows.map((r) => ({
      problem: r.problem,
      slug: r.problem.slug,
      status: r.status,
      attempts: r.attempts,
      bestScore: r.bestScore,
      lastStatus: r.lastStatus,
      solvedAt: r.solvedAt,
      lastSubmissionId: r.lastSubmissionId,
      updatedAt: r.updatedAt,
    }));

  return jsonList(
    items,
    {
      total: items.length,
      limit: items.length,
    },
    {
      items,
    },
  );
});
