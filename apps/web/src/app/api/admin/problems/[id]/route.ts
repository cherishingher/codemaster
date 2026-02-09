import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const UpdateProblemSchema = z.object({
  title: z.string().min(1).optional(),
  difficulty: z.number().int().min(1).max(10).optional(),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  source: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const GET = withAuth(async (_req, { params }) => {
  const problem = await db.problem.findUnique({
    where: { id: params.id },
    include: {
      tags: { include: { tag: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      stats: true,
    },
  });

  if (!problem) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    visibility: problem.visibility,
    source: problem.source,
    tags: problem.tags.map((t) => t.tag.name),
    version: problem.versions[0]?.version ?? null,
    stats: problem.stats,
  });
}, { roles: "admin" });

export const PATCH = withAuth(async (req, { params }) => {
  const payload = UpdateProblemSchema.parse(await req.json());

  const updated = await db.$transaction(async (tx) => {
    const problem = await tx.problem.update({
      where: { id: params.id },
      data: {
        title: payload.title,
        difficulty: payload.difficulty,
        visibility: payload.visibility,
        source: payload.source,
      },
    });

    if (payload.tags) {
      await tx.problemTag.deleteMany({ where: { problemId: problem.id } });
      for (const tagName of payload.tags) {
        const tag = await tx.tag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {},
        });
        await tx.problemTag.create({
          data: { problemId: problem.id, tagId: tag.id },
        });
      }
    }

    return problem;
  });

  return NextResponse.json({ id: updated.id });
}, { roles: "admin" });
