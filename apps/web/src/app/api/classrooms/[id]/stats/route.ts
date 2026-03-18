import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (_req, { params }, user) => {
  const { id } = params;
  const classroom = await db.classroom.findUnique({ where: { id } });
  if (!classroom || (classroom.teacherId !== user.id && !user.roles.includes("admin"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const members = await db.classroomMember.findMany({
    where: { classroomId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const assignments = await db.classroomAssignment.findMany({
    where: { classroomId: id },
    include: {
      problemSet: {
        include: { items: { select: { problemId: true } } },
      },
    },
  });

  const memberIds = members.map((m) => m.userId);
  const allProblemIds = [...new Set(assignments.flatMap((a) => a.problemSet.items.map((i) => i.problemId)))];

  const progress = await db.userProblemProgress.findMany({
    where: { userId: { in: memberIds }, problemId: { in: allProblemIds } },
  });

  const progressMap = new Map<string, Map<string, number>>();
  for (const p of progress) {
    if (!progressMap.has(p.userId)) progressMap.set(p.userId, new Map());
    progressMap.get(p.userId)!.set(p.problemId, p.status);
  }

  const studentStats = members.map((m) => {
    const userProgress = progressMap.get(m.userId) ?? new Map();
    let totalProblems = 0;
    let solved = 0;
    for (const pid of allProblemIds) {
      totalProblems++;
      if (userProgress.get(pid) === 20) solved++;
    }
    return {
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      solved,
      totalProblems,
      completionRate: totalProblems > 0 ? Math.round((solved / totalProblems) * 100) : 0,
    };
  });

  studentStats.sort((a, b) => b.solved - a.solved);

  return NextResponse.json({
    classroomName: classroom.name,
    memberCount: members.length,
    assignmentCount: assignments.length,
    students: studentStats,
  });
});
