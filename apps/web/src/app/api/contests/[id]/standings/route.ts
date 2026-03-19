import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/authz";
import { computeStandings, getContestPhase } from "@/lib/contest";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser(req);

  const contest = await db.contest.findUnique({ where: { id } });
  if (!contest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const phase = getContestPhase(contest);
  if (phase === "upcoming") {
    return NextResponse.json({ error: "contest_not_started" }, { status: 400 });
  }

  const isAdmin = user?.roles.includes("admin");
  const frozen = phase === "frozen" && !isAdmin;

  const durationMs = contest.endAt.getTime() - contest.startAt.getTime();
  const freezeAt = new Date(contest.endAt.getTime() - Math.min(durationMs * 0.2, 60 * 60 * 1000));

  const standings = await computeStandings(contest.id, contest.rule, frozen, freezeAt);

  const problems = await db.contestProblem.findMany({
    where: { contestId: id },
    orderBy: { order: "asc" },
    select: { problemId: true, order: true },
  });

  return NextResponse.json({
    contestId: id,
    rule: contest.rule,
    phase,
    frozen,
    problems: problems.map((p, i) => ({
      id: p.problemId,
      label: String.fromCharCode(65 + i),
    })),
    rows: standings,
  });
}
