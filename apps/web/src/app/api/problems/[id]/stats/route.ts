import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const stat = await db.problemStat.findUnique({
    where: { problemId: id },
  });

  return NextResponse.json(
    stat ?? {
      problemId: id,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      passRate: 0,
      avgTimeMs: 0,
      avgMemoryMb: 0,
    }
  );
}
