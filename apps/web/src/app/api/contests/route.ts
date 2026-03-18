import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { getContestPhase } from "@/lib/contest";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  const status = searchParams.get("status");

  const now = new Date();
  const where: any = {};
  if (status === "upcoming") where.startAt = { gt: now };
  else if (status === "running") { where.startAt = { lte: now }; where.endAt = { gte: now }; }
  else if (status === "ended") where.endAt = { lt: now };

  const [contests, total] = await Promise.all([
    db.contest.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { participants: true, problems: true } },
      },
    }),
    db.contest.count({ where }),
  ]);

  return NextResponse.json({
    items: contests.map((c) => ({
      id: c.id,
      name: c.name,
      rule: c.rule,
      startAt: c.startAt,
      endAt: c.endAt,
      phase: getContestPhase(c),
      participantCount: c._count.participants,
      problemCount: c._count.problems,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

const CreateSchema = z.object({
  name: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  rule: z.enum(["ACM", "OI", "IOI"]).default("ACM"),
  problemIds: z.array(z.string()).optional(),
  inviteCode: z.string().optional(),
});

export const POST = withAuth(async (req) => {
  const data = CreateSchema.parse(await req.json());
  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);

  if (endAt <= startAt) {
    return NextResponse.json({ error: "end_before_start" }, { status: 400 });
  }

  const contest = await db.contest.create({
    data: {
      name: data.name,
      startAt,
      endAt,
      rule: data.rule,
      problems: data.problemIds?.length ? {
        create: data.problemIds.map((pid, i) => ({ problemId: pid, order: i })),
      } : undefined,
    },
  });

  return NextResponse.json({ id: contest.id, name: contest.name });
}, { roles: "admin" });
