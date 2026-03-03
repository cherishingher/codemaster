import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const problemId = searchParams.get("problemId")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const where: Prisma.SubmissionWhereInput = {
    userId: user.id,
  };
  if (problemId) {
    where.problemId = problemId;
  }

  const [total, submissions] = await Promise.all([
    db.submission.count({ where }),
    db.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        problem: {
          select: { title: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: submissions.map((s) => ({
      id: s.id,
      problemId: s.problemId,
      problemTitle: s.problem?.title,
      lang: s.lang,
      status: s.status,
      score: s.score,
      createdAt: s.createdAt,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
