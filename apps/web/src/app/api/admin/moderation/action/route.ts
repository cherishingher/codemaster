import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const ActionSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.string(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = ActionSchema.parse(await req.json());
  const status = payload.action === "approve" ? "approved" : "rejected";

  await db.$transaction(async (tx) => {
    if (payload.targetType === "post") {
      await tx.post.update({ where: { id: payload.targetId }, data: { status } });
    } else {
      await tx.comment.update({ where: { id: payload.targetId }, data: { status } });
    }

    await tx.moderationLog.create({
      data: {
        targetType: payload.targetType,
        targetId: payload.targetId,
        action: payload.action,
        reason: payload.reason,
        adminId: user.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}, { roles: "admin" });
