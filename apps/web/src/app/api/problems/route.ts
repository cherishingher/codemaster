import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser, hasRole } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();

  const user = await getAuthUser(req);
  const isAdmin = !!user && hasRole(user, "admin");
  const where: Prisma.ProblemWhereInput = isAdmin ? {} : { visibility: "public" };
  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }
  if (tag) {
    where.tags = { some: { tag: { name: tag } } };
  }

  const problems = await db.problem.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
  });

  return NextResponse.json(
    problems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      source: p.source,
      visibility: p.visibility,
      version: p.versions[0]?.version ?? null,
      tags: p.tags.map((t) => t.tag.name),
    }))
  );
}
