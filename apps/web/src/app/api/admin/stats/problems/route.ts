import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const rows = await db.$queryRaw<
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
    LIMIT ${limit};
  `;

  return NextResponse.json(rows);
}, { roles: "admin" });
