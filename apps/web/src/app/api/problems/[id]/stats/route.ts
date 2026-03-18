import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProblemId } from "@/lib/problem-identifiers";

export async function GET(
  _: Request,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const problemId = (await resolveProblemId(id)) ?? id
  const stat = await db.problemStat.findUnique({
    where: { problemId },
  });

  return NextResponse.json(
    stat ?? {
      problemId,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      passRate: 0,
      avgTimeMs: 0,
      avgMemoryMb: 0,
    }
  );
}
