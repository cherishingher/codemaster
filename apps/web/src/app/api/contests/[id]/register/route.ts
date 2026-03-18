import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const POST = withAuth(async (_req, { params }, user) => {
  const { id } = params;

  const contest = await db.contest.findUnique({ where: { id } });
  if (!contest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (new Date() > contest.endAt) {
    return NextResponse.json({ error: "contest_ended", message: "比赛已结束" }, { status: 400 });
  }

  const existing = await db.contestParticipant.findUnique({
    where: { contestId_userId: { contestId: id, userId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_registered", message: "已报名" }, { status: 409 });
  }

  await db.contestParticipant.create({
    data: { contestId: id, userId: user.id, status: "joined" },
  });

  return NextResponse.json({ ok: true, message: "报名成功" });
});
