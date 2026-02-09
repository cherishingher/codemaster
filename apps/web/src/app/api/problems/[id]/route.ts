import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hasRole } from "@/lib/authz";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(ctx.params);
  const { searchParams } = new URL(req.url);
  const version = searchParams.get("version");

  const problem = await db.problem.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
    },
  });

  const user = await getAuthUser(req);
  const isAdmin = !!user && hasRole(user, "admin");

  if (!problem || (!isAdmin && problem.visibility !== "public")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pv = await db.problemVersion.findFirst({
    where: {
      problemId: id,
      ...(version ? { version: Number(version) } : {}),
    },
    orderBy: { version: "desc" },
  });

  if (!pv) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    source: problem.source,
    visibility: problem.visibility,
    tags: problem.tags.map((t) => t.tag.name),
    version: pv.version,
    statement: pv.statement,
    constraints: pv.constraints,
    inputFormat: pv.inputFormat,
    outputFormat: pv.outputFormat,
    samples: pv.samples,
    notes: pv.notes,
    timeLimitMs: pv.timeLimitMs,
    memoryLimitMb: pv.memoryLimitMb,
  });
}
