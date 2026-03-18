import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { normalizeProblemAlias, replaceProblemAliases } from "@/lib/problem-aliases";
import {
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin";

const UpdateProblemSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  difficulty: z.number().int().min(1).max(10).optional(),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  source: z.string().optional().nullable(),
  aliases: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

function buildProblemWhere(idOrSlug: string) {
  return {
    OR: [
      { id: idOrSlug },
      { slug: idOrSlug },
      {
        aliases: {
          some: {
            normalizedValue: normalizeProblemAlias(idOrSlug),
          },
        },
      },
    ],
  }
}

export const GET = withAuth(async (_req, { params }) => {
  const problem = await db.problem.findFirst({
    where: buildProblemWhere(params.id),
    include: {
      aliases: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { value: true },
      },
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
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    status: problem.status,
    visible: problem.visible,
    defunct: problem.defunct,
    visibility: problem.visibility,
    source: problem.source,
    aliases: problem.aliases.map((item) => item.value),
    publishedAt: problem.publishedAt,
    currentVersionId: problem.currentVersionId,
    tags: problem.tags.map((t) => t.tag.name),
    version: problem.versions[0]?.version ?? null,
    stats: problem.stats,
  });
}, { roles: "admin" });

export const PATCH = withAuth(async (req, { params }) => {
  const payload = UpdateProblemSchema.parse(await req.json());

  const updated = await db.$transaction(async (tx) => {
    const existing = await tx.problem.findFirst({
      where: buildProblemWhere(params.id),
      select: { id: true, title: true, visibility: true, publishedAt: true },
    });
    if (!existing) {
      throw new Error("problem_not_found");
    }
    const resolvedVisibility = payload.visibility ?? existing.visibility;
    const lifecycle = buildProblemLifecycleData(resolvedVisibility);
    const problem = await tx.problem.update({
      where: { id: existing.id },
      data: {
        slug:
          payload.slug ??
          (payload.title
            ? await generateUniqueProblemSlug(tx, payload.title, existing.id)
            : undefined),
        title: payload.title,
        difficulty: payload.difficulty,
        status: lifecycle.status,
        visible: lifecycle.visible,
        visibility: payload.visibility,
        source:
          payload.source === undefined
            ? undefined
            : payload.source?.trim()
              ? payload.source.trim()
              : null,
        publishedAt:
          resolvedVisibility === "public" || resolvedVisibility === "contest"
            ? existing.publishedAt ?? new Date()
            : null,
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

    if (payload.aliases || payload.source !== undefined) {
      await replaceProblemAliases(tx, problem.id, {
        source:
          payload.source === undefined
            ? problem.source
            : payload.source?.trim()
              ? payload.source.trim()
              : null,
        aliases: payload.aliases,
      });
    }

    return problem;
  });

  return NextResponse.json({ id: updated.id, slug: updated.slug });
}, { roles: "admin" });
