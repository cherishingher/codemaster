import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (_req, _ctx, user) => {
  const memberships = await db.classroomMember.findMany({
    where: { userId: user.id },
    include: {
      classroom: {
        include: {
          teacher: { select: { id: true, name: true } },
          _count: { select: { members: true, assignments: true } },
        },
      },
    },
  });

  const taught = await db.classroom.findMany({
    where: { teacherId: user.id },
    include: {
      _count: { select: { members: true, assignments: true } },
    },
  });

  return NextResponse.json({
    joined: memberships.map((m) => ({
      id: m.classroom.id,
      name: m.classroom.name,
      teacher: m.classroom.teacher,
      memberCount: m.classroom._count.members,
      assignmentCount: m.classroom._count.assignments,
      role: m.role,
    })),
    teaching: taught.map((c) => ({
      id: c.id,
      name: c.name,
      inviteCode: c.inviteCode,
      memberCount: c._count.members,
      assignmentCount: c._count.assignments,
    })),
  });
});

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const POST = withAuth(async (req, _ctx, user) => {
  const data = CreateSchema.parse(await req.json());
  const inviteCode = randomBytes(4).toString("hex").toUpperCase();

  const classroom = await db.classroom.create({
    data: {
      name: data.name,
      description: data.description,
      inviteCode,
      teacherId: user.id,
    },
  });

  return NextResponse.json({ id: classroom.id, inviteCode });
});
