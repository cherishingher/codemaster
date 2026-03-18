import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  rule: z.enum(["ACM", "OI", "IOI"]).optional(),
  problemIds: z.array(z.string()).optional(),
});

export const PATCH = withAuth(async (req, { params }) => {
  const { id } = params;
  const data = UpdateSchema.parse(await req.json());

  const update: any = {};
  if (data.name) update.name = data.name;
  if (data.startAt) update.startAt = new Date(data.startAt);
  if (data.endAt) update.endAt = new Date(data.endAt);
  if (data.rule) update.rule = data.rule;

  await db.$transaction(async (tx) => {
    await tx.contest.update({ where: { id }, data: update });
    if (data.problemIds) {
      await tx.contestProblem.deleteMany({ where: { contestId: id } });
      if (data.problemIds.length) {
        await tx.contestProblem.createMany({
          data: data.problemIds.map((pid, i) => ({ contestId: id, problemId: pid, order: i })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}, { roles: "admin" });

export const DELETE = withAuth(async (_req, { params }) => {
  const { id } = params;
  await db.$transaction([
    db.contestProblem.deleteMany({ where: { contestId: id } }),
    db.contestParticipant.deleteMany({ where: { contestId: id } }),
    db.contest.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}, { roles: "admin" });
