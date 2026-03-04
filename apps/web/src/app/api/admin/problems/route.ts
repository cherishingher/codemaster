import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { buildAdminProblemWhere } from "@/lib/admin-problem-filters";
import {
  buildJudgeConfigCreateManyInput,
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin";

const CreateProblemSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  difficulty: z.number().int().min(1).max(10),
  visibility: z.enum(["public", "private", "hidden", "contest"]).default("public"),
  source: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  statement: z.string().min(1).optional(),
  statementMd: z.string().min(1).optional(),
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
  hints: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  timeLimitMs: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
});

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const difficultyParam = searchParams.get("difficulty")?.trim();
  const visibility = searchParams.get("visibility")?.trim();
  const statusParam = searchParams.get("status")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 50)));

  const difficulty = difficultyParam ? Number(difficultyParam) : null;
  const status = statusParam ? Number(statusParam) : null;

  const where = buildAdminProblemWhere({
    q,
    difficulty,
    visibility,
    status,
  });

  const total = await db.problem.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const problems = await db.problem.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      tags: { include: { tag: true } },
      currentVersion: {
        select: { id: true, version: true },
      },
      stats: true,
    },
  });

  return NextResponse.json({
    items: problems.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      status: p.status,
      visible: p.visible,
      defunct: p.defunct,
      visibility: p.visibility,
      source: p.source,
      tags: p.tags.map((t) => t.tag.name),
      version: p.currentVersion?.version ?? null,
      stats: p.stats,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
  });
}, { roles: "admin" });

export const POST = withAuth(async (req) => {
  const payload = CreateProblemSchema.parse(await req.json());

  const created = await db.$transaction(async (tx) => {
    const slug = payload.slug ?? (await generateUniqueProblemSlug(tx, payload.title));
    const lifecycle = buildProblemLifecycleData(payload.visibility);
    const problem = await tx.problem.create({
      data: {
        slug,
        title: payload.title,
        difficulty: payload.difficulty,
        status: lifecycle.status,
        visible: lifecycle.visible,
        defunct: lifecycle.defunct,
        visibility: payload.visibility,
        source: payload.source,
        publishedAt: lifecycle.publishedAt,
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
      payload.statementMd ||
      payload.constraints ||
      payload.inputFormat ||
      payload.outputFormat ||
      payload.samples ||
      payload.hints ||
      payload.notes
    ) {
      const version = await tx.problemVersion.create({
        data: {
          problemId: problem.id,
          version: 1,
          statement: payload.statement ?? "",
          statementMd: payload.statementMd ?? payload.statement ?? "",
          constraints: payload.constraints,
          hints: payload.hints,
          inputFormat: payload.inputFormat,
          outputFormat: payload.outputFormat,
          samples: payload.samples,
          notes: payload.notes,
          timeLimitMs: payload.timeLimitMs ?? 1000,
          memoryLimitMb: payload.memoryLimitMb ?? 256,
        },
      });

      await tx.problem.update({
        where: { id: problem.id },
        data: { currentVersionId: version.id },
      });

      const judgeConfigs = buildJudgeConfigCreateManyInput({
        versionId: version.id,
        tags: payload.tags,
        timeLimitMs: version.timeLimitMs,
        memoryLimitMb: version.memoryLimitMb,
      });
      if (judgeConfigs.length) {
        await tx.problemJudgeConfig.createMany({
          data: judgeConfigs,
          skipDuplicates: true,
        });
      }
    }

    return problem;
  });

  return NextResponse.json({ id: created.id, slug: created.slug });
}, { roles: "admin" });
