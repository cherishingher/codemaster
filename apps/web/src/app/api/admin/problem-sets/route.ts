import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { jsonData, jsonList } from "@/lib/api-response";

const CreateSetSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  visibility: z.enum(["public", "vip", "purchase", "private", "hidden"]).default("public"),
});

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const skip = (page - 1) * pageSize;

  const [total, sets] = await Promise.all([
    db.problemSet.count(),
    db.problemSet.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { items: true, owner: { select: { id: true, name: true } } },
    }),
  ]);

  const items = sets.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      visibility: s.visibility,
      owner: s.owner,
      count: s.items.length,
    }))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return jsonList(
    items,
    {
      page,
      pageSize,
      total,
      totalPages,
    },
    {
      items,
      page,
      pageSize,
      total,
      totalPages,
    },
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

  return jsonData({ id: created.id }, { status: 201 });
}, { roles: "admin" });
