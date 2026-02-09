import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreateSetSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  visibility: z.enum(["public", "private", "hidden"]).default("public"),
});

export const GET = withAuth(async () => {
  const sets = await db.problemSet.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true, owner: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    sets.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      visibility: s.visibility,
      owner: s.owner,
      count: s.items.length,
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = CreateSetSchema.parse(await req.json());

  const created = await db.problemSet.create({
    data: {
      title: payload.title,
      description: payload.description,
      visibility: payload.visibility,
      ownerId: user.id,
    },
  });

  return NextResponse.json({ id: created.id });
}, { roles: "admin" });
