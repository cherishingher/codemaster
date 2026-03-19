import { db } from "@/lib/db";

export type ContestPhase = "upcoming" | "running" | "frozen" | "ended";

export function getContestPhase(contest: { startAt: Date; endAt: Date; freezeAt?: Date | null }): ContestPhase {
  const now = new Date();
  if (now < contest.startAt) return "upcoming";
  if (now > contest.endAt) return "ended";
  if (contest.freezeAt && now >= contest.freezeAt) return "frozen";
  return "running";
}

export type StandingRow = {
  rank: number;
  userId: string;
  userName: string | null;
  solved: number;
  penalty: number;
  score: number;
  problems: Record<string, {
    attempts: number;
    accepted: boolean;
    acceptedAt: number | null;
    score: number;
    penalty: number;
  }>;
};

export async function computeStandings(
  contestId: string,
  rule: string,
  frozen: boolean,
  freezeAt?: Date | null,
): Promise<StandingRow[]> {
  const participants = await db.contestParticipant.findMany({
    where: { contestId, status: "joined" },
    include: { user: { select: { id: true, name: true } } },
  });

  const contest = await db.contest.findUnique({
    where: { id: contestId },
    include: { problems: { orderBy: { order: "asc" } } },
  });
  if (!contest) return [];

  const problemIds = contest.problems.map((p) => p.problemId);

  const cutoff = frozen && freezeAt ? freezeAt : contest.endAt;

  const submissions = await db.submission.findMany({
    where: {
      problemId: { in: problemIds },
      userId: { in: participants.map((p) => p.userId) },
      createdAt: { gte: contest.startAt, lte: cutoff },
      visible: true,
      defunct: "N",
    },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      problemId: true,
      status: true,
      score: true,
      createdAt: true,
    },
  });

  const userMap = new Map<string, StandingRow>();
  for (const p of participants) {
    userMap.set(p.userId, {
      rank: 0,
      userId: p.userId,
      userName: p.user.name,
      solved: 0,
      penalty: 0,
      score: 0,
      problems: {},
    });
  }

  for (const sub of submissions) {
    const row = userMap.get(sub.userId);
    if (!row) continue;

    const pid = sub.problemId;
    if (!row.problems[pid]) {
      row.problems[pid] = { attempts: 0, accepted: false, acceptedAt: null, score: 0, penalty: 0 };
    }
    const cell = row.problems[pid];
    if (cell.accepted) continue;

    cell.attempts++;
    const isAC = sub.status === "AC" || sub.status === "ACCEPTED";

    if (rule === "OI") {
      cell.score = Math.max(cell.score, sub.score);
    } else {
      if (isAC) {
        cell.accepted = true;
        const minutes = Math.floor((sub.createdAt.getTime() - contest.startAt.getTime()) / 60000);
        cell.acceptedAt = minutes;
        cell.penalty = minutes + (cell.attempts - 1) * 20;
      }
    }
  }

  const rows = [...userMap.values()];
  for (const row of rows) {
    if (rule === "OI") {
      row.score = Object.values(row.problems).reduce((s, c) => s + c.score, 0);
      row.solved = Object.values(row.problems).filter((c) => c.score > 0).length;
    } else {
      row.solved = Object.values(row.problems).filter((c) => c.accepted).length;
      row.penalty = Object.values(row.problems).reduce((s, c) => s + c.penalty, 0);
    }
  }

  if (rule === "OI") {
    rows.sort((a, b) => b.score - a.score || a.penalty - b.penalty);
  } else {
    rows.sort((a, b) => b.solved - a.solved || a.penalty - b.penalty);
  }

  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
