import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));

  const [contests, total] = await Promise.all([
    db.contest.findMany({
      orderBy: { startAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { participants: true, problems: true } },
        problems: { orderBy: { order: "asc" }, include: { problem: { select: { id: true, title: true, slug: true } } } },
      },
    }),
    db.contest.count(),
  ]);

  return NextResponse.json({
    items: contests.map((c) => ({
      id: c.id,
      name: c.name,
      rule: c.rule,
      startAt: c.startAt,
      endAt: c.endAt,
      participantCount: c._count.participants,
      problemCount: c._count.problems,
      problems: c.problems.map((cp) => ({ id: cp.problem.id, title: cp.problem.title, slug: cp.problem.slug, order: cp.order })),
    })),
    page, pageSize, total, totalPages: Math.ceil(total / pageSize),
  });
}, { roles: "admin" });

const CreateSchema = z.object({
  name: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  rule: z.enum(["ACM", "OI", "IOI"]).default("ACM"),
  problemIds: z.array(z.string()).optional(),
});

export const POST = withAuth(async (req) => {
  const data = CreateSchema.parse(await req.json());
  const contest = await db.contest.create({
    data: {
      name: data.name,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      rule: data.rule,
      problems: data.problemIds?.length
        ? { create: data.problemIds.map((pid, i) => ({ problemId: pid, order: i })) }
        : undefined,
    },
  });
  return NextResponse.json({ id: contest.id });
}, { roles: "admin" });
