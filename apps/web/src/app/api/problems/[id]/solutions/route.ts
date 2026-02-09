import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const solutions = await db.solution.findMany({
    where: {
      problemId: id,
      visibility: "public",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      content: true,
      videoUrl: true,
      createdAt: true,
      author: {
        select: { id: true, name: true },
      },
      version: {
        select: { id: true, version: true },
      },
    },
  });

  return NextResponse.json(solutions);
}
