import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const sets = await db.problemSet.findMany({
    where: {
      visibility: "public",
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      owner: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(
    sets.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      createdAt: s.createdAt,
      owner: s.owner,
      count: s._count.items,
    }))
  );
}
