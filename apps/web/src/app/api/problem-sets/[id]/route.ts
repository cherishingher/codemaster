import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const set = await db.problemSet.findFirst({
    where: { id, visibility: "public" },
    include: {
      owner: { select: { id: true, name: true } },
      items: {
        orderBy: { orderIndex: "asc" },
        include: {
          problem: {
            include: {
              tags: { include: { tag: true } },
              versions: {
                orderBy: { version: "desc" },
                take: 1,
                select: { id: true, version: true },
              },
            },
          },
        },
      },
    },
  });

  if (!set) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: set.id,
    title: set.title,
    description: set.description,
    createdAt: set.createdAt,
    owner: set.owner,
    items: set.items.map((item) => ({
      orderIndex: item.orderIndex,
      problem: {
        id: item.problem.id,
        title: item.problem.title,
        difficulty: item.problem.difficulty,
        source: item.problem.source,
        tags: item.problem.tags.map((t) => t.tag.name),
        version: item.problem.versions[0]?.version ?? null,
      },
    })),
  });
}
