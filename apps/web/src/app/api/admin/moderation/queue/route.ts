import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  const posts = await db.post.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });

  const comments = await db.comment.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      author: p.user?.name ?? null,
      createdAt: p.createdAt,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      content: c.content,
      author: c.user?.name ?? null,
      createdAt: c.createdAt,
    })),
  });
}, { roles: "admin" });
