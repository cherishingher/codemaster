import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const ItemSchema = z.object({
  problemId: z.string().min(1),
  orderIndex: z.number().int().min(0),
});

const SetSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(["public", "vip", "purchase", "private", "hidden"]).optional(),
  items: z.array(ItemSchema).optional(),
});

const PayloadSchema = z.object({
  sets: z.array(SetSchema).min(1),
});

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = PayloadSchema.parse(await req.json());

  let created = 0;
  for (const s of payload.sets) {
    await db.$transaction(async (tx) => {
      const set = await tx.problemSet.create({
        data: {
          title: s.title,
          description: s.description,
          visibility: s.visibility ?? "public",
          ownerId: user.id,
        },
      });

      if (s.items?.length) {
        await tx.problemSetItem.createMany({
          data: s.items.map((i) => ({
            setId: set.id,
            problemId: i.problemId,
            orderIndex: i.orderIndex,
          })),
          skipDuplicates: true,
        });
      }
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}, { roles: "admin" });
