import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const cursor = searchParams.get("cursor");

  const posts = await db.post.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    items: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      author: p.user?.name ?? null,
      createdAt: p.createdAt,
    })),
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  });
}

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = CreatePostSchema.parse(await req.json());

  const post = await db.post.create({
    data: {
      userId: user.id,
      title: payload.title,
      content: payload.content,
      status: "pending",
    },
  });

  return NextResponse.json({ id: post.id, status: post.status });
});
