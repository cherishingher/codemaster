import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { buildAdminProblemWhere } from "@/lib/admin-problem-filters";
import { buildProblemLifecycleData } from "@/lib/problem-admin";
import { ProblemLifecycleStatus } from "@/lib/oj";

const FilterSchema = z.object({
  q: z.string().trim().optional(),
  difficulty: z.number().int().min(1).max(10).optional(),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  status: z.number().int().optional(),
});

const BulkActionSchema = z.object({
  problemIds: z.array(z.string().min(1)).min(1).max(200).optional(),
  selectAllMatching: z.boolean().optional().default(false),
  filters: FilterSchema.optional(),
  action: z.enum([
    "set_visibility",
    "archive",
    "set_source",
    "add_tags",
    "replace_tags",
    "remove_tags",
  ]),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  source: z.string().optional().nullable(),
  tags: z.array(z.string().min(1)).max(100).optional(),
}).superRefine((value, ctx) => {
  if (value.selectAllMatching) return;
  if (!value.problemIds?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "problem_ids_required",
      path: ["problemIds"],
    });
  }
});

const BulkLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  action: z.enum([
    "set_visibility",
    "archive",
    "set_source",
    "add_tags",
    "replace_tags",
    "remove_tags",
  ]).optional(),
  selectionMode: z.enum(["ids", "filtered"]).optional(),
  adminQuery: z.string().trim().optional(),
});

const ROLLBACK_PREVIEW_LIMIT = 12;

function sanitizeFilters(filters?: z.infer<typeof FilterSchema>) {
  if (!filters) return null;
  return {
    q: filters.q?.trim() || null,
    difficulty: filters.difficulty ?? null,
    visibility: filters.visibility ?? null,
    status: filters.status ?? null,
  };
}

function toIsoString(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function buildRollbackSuggestion(
  action: z.infer<typeof BulkActionSchema>["action"],
  problems: Array<{
    id: string;
    slug: string;
    title: string;
    visibility: string;
    status: number;
    visible: boolean;
    defunct: string;
    source: string | null;
    publishedAt: Date | null;
    tags: Array<{ tag: { name: string } }>;
  }>
) {
  const previewProblems = problems.slice(0, ROLLBACK_PREVIEW_LIMIT);

  if (action === "archive" || action === "set_visibility") {
    return {
      kind: "problem_lifecycle",
      summary: "如需恢复，请按以下快照逐题恢复可见性状态。建议使用批量改可见性或单题编辑完成回滚。",
      capturedCount: problems.length,
      truncated: problems.length > ROLLBACK_PREVIEW_LIMIT,
      items: previewProblems.map((problem) => ({
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        visibility: problem.visibility,
        status: problem.status,
        visible: problem.visible,
        defunct: problem.defunct,
        publishedAt: toIsoString(problem.publishedAt),
      })),
    };
  }

  if (action === "set_source") {
    return {
      kind: "problem_source",
      summary: "如需恢复，请将来源改回下列旧值。批量来源变更不会自动保留旧来源，回滚时以这里的快照为准。",
      capturedCount: problems.length,
      truncated: problems.length > ROLLBACK_PREVIEW_LIMIT,
      items: previewProblems.map((problem) => ({
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        source: problem.source,
      })),
    };
  }

  return {
    kind: "problem_tags",
    summary: "如需恢复，请将标签覆盖回下列旧集合，或按题目逐一编辑标签。",
    capturedCount: problems.length,
    truncated: problems.length > ROLLBACK_PREVIEW_LIMIT,
    items: previewProblems.map((problem) => ({
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      tags: problem.tags.map((tag) => tag.tag.name),
    })),
  };
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = BulkLogQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    selectionMode: searchParams.get("selectionMode") ?? undefined,
    adminQuery: searchParams.get("adminQuery") ?? undefined,
  });
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 10;
  const adminQuery = query.adminQuery?.trim();
  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.selectionMode ? { selectionMode: query.selectionMode } : {}),
    ...(adminQuery
      ? {
          admin: {
            OR: [
              { email: { contains: adminQuery, mode: "insensitive" as const } },
              { name: { contains: adminQuery, mode: "insensitive" as const } },
              { id: { contains: adminQuery, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    db.adminProblemBulkOperationLog.count({ where }),
    db.adminProblemBulkOperationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        admin: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      selectionMode: log.selectionMode,
      filters: log.filters,
      payload: log.payload,
      matchedCount: log.matchedCount,
      targets: log.targets,
      result: log.result,
      createdAt: log.createdAt,
      admin: log.admin,
    })),
  });
}, { roles: "admin" });

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = BulkActionSchema.parse(await req.json());
  const problemIds = Array.from(new Set(payload.problemIds ?? []));
  const tags = Array.from(new Set((payload.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));

  if (payload.action === "set_visibility" && !payload.visibility) {
    return NextResponse.json({ error: "visibility_required" }, { status: 400 });
  }

  if (payload.action === "set_source" && payload.source === undefined) {
    return NextResponse.json({ error: "source_required" }, { status: 400 });
  }

  if ((payload.action === "add_tags" || payload.action === "remove_tags") && tags.length === 0) {
    return NextResponse.json({ error: "tags_required" }, { status: 400 });
  }

  const filters = sanitizeFilters(payload.filters);
  const selectionMode = payload.selectAllMatching ? "filtered" : "ids";

  const result = await db.$transaction(async (tx) => {
    const where = payload.selectAllMatching
      ? buildAdminProblemWhere(payload.filters ?? {})
      : { id: { in: problemIds } };
    const existingProblems = await tx.problem.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        visibility: true,
        status: true,
        visible: true,
        defunct: true,
        source: true,
        tags: {
          select: {
            tag: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    const rollbackSuggestion = buildRollbackSuggestion(payload.action, existingProblems);

    const baseResult = {
      matchedProblems: existingProblems.length,
      updatedProblems: 0,
      createdProblemTags: 0,
      deletedProblemTags: 0,
    };

    if (existingProblems.length === 0) {
      await tx.adminProblemBulkOperationLog.create({
        data: {
          adminId: user.id,
          action: payload.action,
          selectionMode,
          filters: filters ?? undefined,
          payload: {
            visibility: payload.visibility ?? null,
            source: payload.source ?? null,
            tags,
          },
          matchedCount: 0,
          targets: [],
          result: baseResult,
        },
      });
      return baseResult;
    }

    let resultPayload = { ...baseResult, updatedProblems: existingProblems.length };

    if (payload.action === "archive") {
      for (const problem of existingProblems) {
        await tx.problem.update({
          where: { id: problem.id },
          data: {
            status: ProblemLifecycleStatus.ARCHIVED,
            visible: false,
            defunct: "Y",
            visibility: "hidden",
            publishedAt: problem.publishedAt,
          },
        });
      }
    } else if (payload.action === "set_visibility") {
      const lifecycle = buildProblemLifecycleData(payload.visibility);
      const now = new Date();
      for (const problem of existingProblems) {
        await tx.problem.update({
          where: { id: problem.id },
          data: {
            status: lifecycle.status,
            visible: lifecycle.visible,
            defunct: lifecycle.defunct,
            visibility: payload.visibility,
            publishedAt:
              payload.visibility === "public" || payload.visibility === "contest"
                ? problem.publishedAt ?? now
                : null,
          },
        });
      }
    } else if (payload.action === "set_source") {
      const normalizedSource = payload.source?.trim() ? payload.source.trim() : null;
      const updateResult = await tx.problem.updateMany({
        where: { id: { in: existingProblems.map((problem) => problem.id) } },
        data: { source: normalizedSource },
      });
      resultPayload = { ...resultPayload, updatedProblems: updateResult.count };
    } else {
      const tagMap = new Map<string, string>();
      if (tags.length > 0) {
        for (const tagName of tags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
            select: { id: true, name: true },
          });
          tagMap.set(tag.name, tag.id);
        }
      }

      if (payload.action === "replace_tags") {
        const deleted = await tx.problemTag.deleteMany({
          where: { problemId: { in: existingProblems.map((problem) => problem.id) } },
        });

        let createdCount = 0;
        if (tagMap.size > 0) {
          const createResult = await tx.problemTag.createMany({
            data: existingProblems.flatMap((problem) =>
              Array.from(tagMap.values()).map((tagId) => ({
                problemId: problem.id,
                tagId,
              }))
            ),
            skipDuplicates: true,
          });
          createdCount = createResult.count;
        }

        resultPayload = {
          ...resultPayload,
          createdProblemTags: createdCount,
          deletedProblemTags: deleted.count,
        };
      } else {
        const targetTagIds = Array.from(tagMap.values());
        if (payload.action === "add_tags") {
          const created = await tx.problemTag.createMany({
            data: existingProblems.flatMap((problem) =>
              targetTagIds.map((tagId) => ({
                problemId: problem.id,
                tagId,
              }))
            ),
            skipDuplicates: true,
          });

          resultPayload = {
            ...resultPayload,
            createdProblemTags: created.count,
          };
        } else {
          const deleted = await tx.problemTag.deleteMany({
            where: {
              problemId: { in: existingProblems.map((problem) => problem.id) },
              tagId: { in: targetTagIds },
            },
          });

          resultPayload = {
            ...resultPayload,
            deletedProblemTags: deleted.count,
          };
        }
      }
    }

    await tx.adminProblemBulkOperationLog.create({
      data: {
        adminId: user.id,
        action: payload.action,
        selectionMode,
        filters: filters ?? undefined,
        payload: {
          visibility: payload.visibility ?? null,
          source: payload.source ?? null,
          tags,
        },
        matchedCount: existingProblems.length,
        targets: existingProblems.map((problem) => ({
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
        })),
        result: {
          ...resultPayload,
          rollbackSuggestion,
        },
      },
    });

    return {
      ...resultPayload,
      rollbackSuggestion,
    };
  });

  return NextResponse.json({
    action: payload.action,
    selectAllMatching: payload.selectAllMatching,
    visibility: payload.visibility ?? null,
    source: payload.source ?? null,
    tags,
    ...result,
  });
}, { roles: "admin" });
