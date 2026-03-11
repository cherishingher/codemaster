import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/authz";
import { createContentAccessEvaluator } from "@/server/modules/content-access/service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const user = await getAuthUser(req);
  const evaluator = await createContentAccessEvaluator(user ?? undefined);

  const sets = await db.problemSet.findMany({
    where: {
      status: "published",
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      createdAt: true,
      owner: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  const items = await Promise.all(
    sets.map(async (set) => ({
      set,
      access: await evaluator.canAccessProblemSet({
        id: set.id,
        visibility: set.visibility,
      }),
    })),
  )

  return NextResponse.json(
    items
      .filter((item) => item.access.allowed)
      .map(({ set, access }) => ({
        id: set.id,
        title: set.title,
        description: set.description,
        visibility: set.visibility,
        createdAt: set.createdAt,
        owner: set.owner,
        count: set._count.items,
        access,
      })),
  );
}
