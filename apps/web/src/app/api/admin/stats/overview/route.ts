import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { jsonData } from "@/lib/api-response";

export const GET = withAuth(async () => {
  const [
    users,
    problems,
    submissions,
    accepted,
    problemSets,
    solutions,
  ] = await Promise.all([
    db.user.count(),
    db.problem.count(),
    db.submission.count(),
    db.submission.count({ where: { status: "AC" } }),
    db.problemSet.count(),
    db.solution.count(),
  ]);

  const activeUsers = await db.userProblemProgress.count({
    where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
  });

  const recentSubmissions = await db.$queryRaw<
    { day: string; total: number; accepted: number }[]
  >`
    SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day,
           COUNT(*)::int as total,
           SUM(CASE WHEN "status" = 'AC' THEN 1 ELSE 0 END)::int as accepted
    FROM "Submission"
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY day
    ORDER BY day ASC;
  `;

  const topProblems = await db.$queryRaw<
    { problemId: string; title: string; total: number; accepted: number }[]
  >`
    SELECT p.id as "problemId",
           p.title as title,
           COUNT(s.*)::int as total,
           SUM(CASE WHEN s."status" = 'AC' THEN 1 ELSE 0 END)::int as accepted
    FROM "Submission" s
    JOIN "Problem" p ON p.id = s."problemId"
    GROUP BY p.id
    ORDER BY total DESC
    LIMIT 10;
  `;

  return jsonData({
    counts: {
      users,
      problems,
      submissions,
      accepted,
      problemSets,
      solutions,
      activeUsers7d: activeUsers,
    },
    recentSubmissions,
    topProblems,
  });
}, { roles: "admin" });
