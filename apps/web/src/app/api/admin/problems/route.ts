import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreateProblemSchema = z.object({
  title: z.string().min(1),
  difficulty: z.number().int().min(1).max(10),
  visibility: z.enum(["public", "private", "hidden", "contest"]).default("public"),
  source: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  statement: z.string().min(1).optional(),
  constraints: z.string().min(1).optional(),
  inputFormat: z.string().min(1).optional(),
  outputFormat: z.string().min(1).optional(),
  samples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
        explain: z.string().optional(),
      })
    )
    .optional(),
  notes: z.string().min(1).optional(),
  timeLimitMs: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
});

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const problems = await db.problem.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      tags: { include: { tag: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true },
      },
      stats: true,
    },
  });

  return NextResponse.json(
    problems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      visibility: p.visibility,
      source: p.source,
      tags: p.tags.map((t) => t.tag.name),
      version: p.versions[0]?.version ?? null,
      stats: p.stats,
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req) => {
  const payload = CreateProblemSchema.parse(await req.json());

  const created = await db.$transaction(async (tx) => {
    const problem = await tx.problem.create({
      data: {
        title: payload.title,
        difficulty: payload.difficulty,
        visibility: payload.visibility,
        source: payload.source,
      },
    });

    if (payload.tags?.length) {
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

    if (
      payload.statement ||
      payload.constraints ||
      payload.inputFormat ||
      payload.outputFormat ||
      payload.samples ||
      payload.notes
    ) {
      await tx.problemVersion.create({
        data: {
          problemId: problem.id,
          version: 1,
          statement: payload.statement ?? "",
          constraints: payload.constraints,
          inputFormat: payload.inputFormat,
          outputFormat: payload.outputFormat,
          samples: payload.samples,
          notes: payload.notes,
          timeLimitMs: payload.timeLimitMs ?? 1000,
          memoryLimitMb: payload.memoryLimitMb ?? 256,
        },
      });
    }

    return problem;
  });

  return NextResponse.json({ id: created.id });
}, { roles: "admin" });
