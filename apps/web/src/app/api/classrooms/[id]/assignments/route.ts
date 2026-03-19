import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (_req, { params }, user) => {
  const { id } = params;
  const member = await db.classroomMember.findUnique({
    where: { classroomId_userId: { classroomId: id, userId: user.id } },
  });
  const classroom = await db.classroom.findUnique({ where: { id } });
  if (!member && classroom?.teacherId !== user.id && !user.roles.includes("admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const assignments = await db.classroomAssignment.findMany({
    where: { classroomId: id },
    orderBy: { createdAt: "desc" },
    include: {
      problemSet: {
        select: { id: true, title: true, _count: { select: { items: true } } },
      },
    },
  });

  return NextResponse.json(assignments.map((a) => ({
    id: a.id,
    title: a.title,
    dueAt: a.dueAt,
    createdAt: a.createdAt,
    problemSet: { id: a.problemSet.id, title: a.problemSet.title, count: a.problemSet._count.items },
  })));
});

const CreateSchema = z.object({
  title: z.string().min(1),
  problemSetId: z.string().min(1),
  dueAt: z.string().datetime().optional(),
});

export const POST = withAuth(async (req, { params }, user) => {
  const { id } = params;
  const classroom = await db.classroom.findUnique({ where: { id } });
  if (!classroom || (classroom.teacherId !== user.id && !user.roles.includes("admin"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data = CreateSchema.parse(await req.json());
  const assignment = await db.classroomAssignment.create({
    data: {
      classroomId: id,
      problemSetId: data.problemSetId,
      title: data.title,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
    },
  });

  return NextResponse.json({ id: assignment.id });
});
