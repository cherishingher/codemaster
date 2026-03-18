import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthUser, withAuth } from "@/lib/authz";
import { getContestPhase } from "@/lib/contest";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser(req);

  const contest = await db.contest.findUnique({
    where: { id },
    include: {
      problems: {
        orderBy: { order: "asc" },
        include: {
          problem: { select: { id: true, slug: true, title: true, difficulty: true } },
        },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!contest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const phase = getContestPhase(contest);
  let registered = false;
  if (user) {
    const p = await db.contestParticipant.findUnique({
      where: { contestId_userId: { contestId: id, userId: user.id } },
    });
    registered = !!p;
  }

  const showProblems = phase !== "upcoming" || user?.roles.includes("admin");

  return NextResponse.json({
    id: contest.id,
    name: contest.name,
    rule: contest.rule,
    startAt: contest.startAt,
    endAt: contest.endAt,
    phase,
    participantCount: contest._count.participants,
    registered,
    problems: showProblems
      ? contest.problems.map((cp, i) => ({
          order: i,
          label: String.fromCharCode(65 + i),
          id: cp.problem.id,
          slug: cp.problem.slug,
          title: cp.problem.title,
          difficulty: cp.problem.difficulty,
        }))
      : [],
  });
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  rule: z.enum(["ACM", "OI", "IOI"]).optional(),
});

export const PATCH = withAuth(async (req, { params }) => {
  const { id } = params;
  const data = UpdateSchema.parse(await req.json());
  const update: any = {};
  if (data.name) update.name = data.name;
  if (data.startAt) update.startAt = new Date(data.startAt);
  if (data.endAt) update.endAt = new Date(data.endAt);
  if (data.rule) update.rule = data.rule;

  const contest = await db.contest.update({ where: { id }, data: update });
  return NextResponse.json({ id: contest.id });
}, { roles: "admin" });
