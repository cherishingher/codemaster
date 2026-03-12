import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/authz";
import { jsonData } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const post = await db.post.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (post.status !== "approved") {
    const user = await getAuthUser(req);
    if (!user || !user.roles.includes("admin")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  return jsonData({
    id: post.id,
    title: post.title,
    content: post.content,
    status: post.status,
    author: post.user?.name ?? null,
    createdAt: post.createdAt,
  });
}
