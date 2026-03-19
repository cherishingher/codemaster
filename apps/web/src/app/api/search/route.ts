import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ problems: [], posts: [], problemSets: [] });
  }

  const [problems, posts, problemSets] = await Promise.all([
    db.problem.findMany({
      where: {
        visible: true,
        defunct: "N",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { source: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, slug: true, title: true, difficulty: true },
    }),
    db.post.findMany({
      where: {
        status: "approved",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, title: true, createdAt: true },
    }),
    db.problemSet.findMany({
      where: {
        visibility: "public",
        title: { contains: q, mode: "insensitive" },
      },
      take: 10,
      select: { id: true, title: true },
    }),
  ]);

  return NextResponse.json({ problems, posts, problemSets });
}
