import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const JoinSchema = z.object({ inviteCode: z.string().min(1) });

export const POST = withAuth(async (req, { params }, user) => {
  const { id } = params;
  const { inviteCode } = JoinSchema.parse(await req.json());

  const classroom = await db.classroom.findUnique({ where: { id } });
  if (!classroom || classroom.inviteCode !== inviteCode) {
    return NextResponse.json({ error: "invalid_code", message: "邀请码无效" }, { status: 400 });
  }

  const existing = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: id, userId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "already_joined" }, { status: 409 });
  }

  await db.classroomMember.create({
    data: { classroomId: id, userId: user.id, role: "student" },
  });

  return NextResponse.json({ ok: true, message: "加入成功" });
});
