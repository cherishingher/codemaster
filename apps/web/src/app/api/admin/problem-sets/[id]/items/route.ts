import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const ItemSchema = z.object({
  problemId: z.string().min(1),
  orderIndex: z.number().int().min(0),
});

const PayloadSchema = z.object({
  items: z.array(ItemSchema).min(1),
});

export const POST = withAuth(async (req, { params }) => {
  const payload = PayloadSchema.parse(await req.json());

  const set = await db.problemSet.findUnique({ where: { id: params.id } });
  if (!set) {
    return NextResponse.json({ error: "set_not_found" }, { status: 404 });
  }

  const rows = payload.items.map((item) => ({
    setId: params.id,
    problemId: item.problemId,
    orderIndex: item.orderIndex,
  }));

  await db.problemSetItem.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, count: rows.length });
}, { roles: "admin" });
