import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser, hasRole } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();
  const difficulty = searchParams.get("difficulty");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const user = await getAuthUser(req);
  const isAdmin = !!user && hasRole(user, "admin");
  const where: Prisma.ProblemWhereInput = isAdmin ? {} : { visibility: "public" };
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (tag) {
    where.tags = { some: { tag: { name: tag } } };
  }
  if (difficulty) {
    where.difficulty = parseInt(difficulty);
  }

  const [total, problems] = await Promise.all([
    db.problem.count({ where }),
    db.problem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: problems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      source: p.source,
      visibility: p.visibility,
      version: p.versions[0]?.version ?? null,
      tags: p.tags.map((t) => t.tag.name),
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  });
}
