import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreateCommentSchema = z.object({
  content: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const comments = await db.comment.findMany({
    where: { postId: id, status: "approved" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.user?.name ?? null,
      createdAt: c.createdAt,
    }))
  );
}

export const POST = withAuth(async (req, { params }, user) => {
  const payload = CreateCommentSchema.parse(await req.json());

  const comment = await db.comment.create({
    data: {
      postId: params.id,
      userId: user.id,
      content: payload.content,
      status: "pending",
    },
  });

  return NextResponse.json({ id: comment.id, status: comment.status });
});
