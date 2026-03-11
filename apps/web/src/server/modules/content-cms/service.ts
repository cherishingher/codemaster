import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type {
  CmsAssetCreateInput,
  CmsAssetItem,
  CmsOverviewResponse,
  CmsPathBulkItemsInput,
  CmsPathDetail,
  CmsPathListItem,
  CmsPathUpdateInput,
  CmsResourceType,
  CmsSolutionDetail,
  CmsSolutionUpdateInput,
  CmsStatus,
  CmsStatusTransitionInput,
  CmsVideoListItem,
  CmsVideoUpdateInput,
  CmsWorkflowLogItem,
} from "@/lib/content-cms"
import { listLinkedProductsForTargets } from "@/server/modules/recommendation-center/service"

type Operator = {
  id: string
}

type WorkflowTarget = {
  resourceType: CmsResourceType
  resourceId: string
}

const VALID_STATUS: CmsStatus[] = ["draft", "review", "published"]

export class ContentCmsError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function normalizeStatus(value?: string | null): CmsStatus {
  const normalized = value?.trim().toLowerCase() as CmsStatus | undefined
  if (!normalized) return "draft"
  if (!VALID_STATUS.includes(normalized)) {
    throw new ContentCmsError("invalid_status", "内容状态不合法", 400)
  }
  return normalized
}

function normalizeAccessLevel(value?: string | null) {
  if (value == null) return null
  const normalized = value.trim().toUpperCase()
  if (!normalized) return null
  if (["FREE", "MEMBERSHIP", "PURCHASE", "MEMBERSHIP_OR_PURCHASE"].includes(normalized)) {
    return normalized
  }
  throw new ContentCmsError("invalid_access_level", "accessLevel 不合法", 400)
}

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function mapWorkflowLog(log: {
  id: string
  resourceType: string
  resourceId: string
  fromStatus: string | null
  toStatus: string
  action: string
  note: string | null
  createdAt: Date
  operator: {
    id: string
    name: string | null
    email: string | null
  }
}): CmsWorkflowLogItem {
  return {
    id: log.id,
    resourceType: log.resourceType as CmsResourceType,
    resourceId: log.resourceId,
    fromStatus: log.fromStatus,
    toStatus: log.toStatus,
    action: log.action,
    note: log.note,
    operator: log.operator,
    createdAt: log.createdAt.toISOString(),
  }
}

function mapAsset(asset: {
  id: string
  assetType: string
  title: string
  description: string | null
  status: string
  sourceUrl: string
  mimeType: string | null
  durationSec: number | null
  thumbnailUrl: string | null
  resourceType: string | null
  resourceId: string | null
  createdAt: Date
  updatedAt: Date
}): CmsAssetItem {
  return {
    id: asset.id,
    assetType: asset.assetType,
    title: asset.title,
    description: asset.description,
    status: asset.status,
    sourceUrl: asset.sourceUrl,
    mimeType: asset.mimeType,
    durationSec: asset.durationSec,
    thumbnailUrl: asset.thumbnailUrl,
    resourceType: asset.resourceType,
    resourceId: asset.resourceId,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

async function writeWorkflowLog(
  tx: Prisma.TransactionClient,
  input: CmsStatusTransitionInput & {
    fromStatus?: string | null
    action: string
    operatorId: string
  },
) {
  const log = await tx.contentWorkflowLog.create({
    data: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      action: input.action,
      note: input.note?.trim() || null,
      operatorId: input.operatorId,
      payload: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    },
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  await tx.moderationLog.create({
    data: {
      targetType: input.resourceType,
      targetId: input.resourceId,
      action: input.action,
      reason: input.note?.trim() || null,
      adminId: input.operatorId,
    },
  })

  return mapWorkflowLog(log)
}

async function getCurrentStatus(
  tx: Prisma.TransactionClient,
  resourceType: CmsResourceType,
  resourceId: string,
) {
  switch (resourceType) {
    case "solution": {
      const record = await tx.solution.findUnique({
        where: { id: resourceId },
        select: { status: true },
      })
      if (!record) throw new ContentCmsError("solution_not_found", "题解不存在", 404)
      return record.status
    }
    case "video": {
      const record = await tx.lesson.findUnique({
        where: { id: resourceId },
        select: { status: true },
      })
      if (!record) throw new ContentCmsError("lesson_not_found", "视频内容不存在", 404)
      return record.status
    }
    case "training_path": {
      const record = await tx.problemSet.findUnique({
        where: { id: resourceId },
        select: { status: true },
      })
      if (!record) throw new ContentCmsError("path_not_found", "训练路径不存在", 404)
      return record.status
    }
  }
}

async function updateCurrentStatus(
  tx: Prisma.TransactionClient,
  resourceType: CmsResourceType,
  resourceId: string,
  toStatus: CmsStatus,
) {
  switch (resourceType) {
    case "solution":
      await tx.solution.update({
        where: { id: resourceId },
        data: { status: toStatus },
      })
      return
    case "video":
      await tx.lesson.update({
        where: { id: resourceId },
        data: { status: toStatus },
      })
      return
    case "training_path":
      await tx.problemSet.update({
        where: { id: resourceId },
        data: { status: toStatus },
      })
      return
  }
}

async function mapSolutionDetail(solution: {
  id: string
  title: string
  summary: string | null
  content: string
  templateType: string | null
  type: string
  visibility: string
  accessLevel: string | null
  isPremium: boolean
  videoUrl: string | null
  status: string
  problem: {
    id: string
    slug: string
    title: string
    difficulty: number
    tags: Array<{ tag: { name: string } }>
  }
}, workflowLogs: CmsWorkflowLogItem[]): Promise<CmsSolutionDetail> {
  const tagHints = solution.problem.tags.map((item) => item.tag.name)
  const [linkedProducts, suggestedProducts] = await Promise.all([
    listLinkedProductsForTargets({
      targets: [
        { type: "solution", id: solution.id },
        { type: "problem", id: solution.problem.id },
      ],
      tagHints,
      limit: 4,
    }),
    listLinkedProductsForTargets({
      targets: [],
      tagHints,
      limit: 4,
    }),
  ])

  return {
    id: solution.id,
    title: solution.title,
    summary: solution.summary,
    content: solution.content,
    templateType: solution.templateType,
    type: solution.type,
    visibility: solution.visibility,
    accessLevel: solution.accessLevel,
    isPremium: solution.isPremium,
    videoUrl: solution.videoUrl,
    status: solution.status,
    problem: {
      id: solution.problem.id,
      slug: solution.problem.slug,
      title: solution.problem.title,
      difficulty: solution.problem.difficulty,
      tags: solution.problem.tags.map((item) => item.tag.name),
    },
    linkedProducts,
    suggestedProducts,
    workflowLogs,
  }
}

export async function getContentCmsOverview(): Promise<CmsOverviewResponse["data"]> {
  const [solutions, videos, paths, recentLogs] = await Promise.all([
    db.solution.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.lesson.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.problemSet.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { kind: "training_path" },
    }),
    db.contentWorkflowLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ])

  const buildCounts = (rows: Array<{ status: string; _count: { _all: number } }>) => ({
    draft: rows.find((item) => item.status === "draft")?._count._all ?? 0,
    review: rows.find((item) => item.status === "review")?._count._all ?? 0,
    published: rows.find((item) => item.status === "published")?._count._all ?? 0,
  })

  return {
    counts: {
      solution: buildCounts(solutions),
      video: buildCounts(videos),
      training_path: buildCounts(paths),
    },
    recentLogs: recentLogs.map(mapWorkflowLog),
  }
}

export async function getCmsSolutionDetail(id: string): Promise<CmsSolutionDetail> {
  const [solution, workflowLogs] = await Promise.all([
    db.solution.findUnique({
      where: { id },
      include: {
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            tags: {
              select: {
                tag: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    }),
    listWorkflowLogs({ resourceType: "solution", resourceId: id }),
  ])

  if (!solution) {
    throw new ContentCmsError("solution_not_found", "题解不存在", 404)
  }

  return mapSolutionDetail(solution, workflowLogs)
}

export async function updateCmsSolution(id: string, input: CmsSolutionUpdateInput) {
  const solution = await db.solution.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!solution) {
    throw new ContentCmsError("solution_not_found", "题解不存在", 404)
  }

  await db.solution.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      summary: input.summary?.trim() || null,
      content: input.content ?? undefined,
      templateType: input.templateType?.trim() || null,
      visibility: input.visibility?.trim() || undefined,
      accessLevel: normalizeAccessLevel(input.accessLevel),
      isPremium: input.isPremium ?? undefined,
      videoUrl: input.videoUrl?.trim() || null,
    },
  })
}

export async function listVideoLessons(): Promise<CmsVideoListItem[]> {
  const [lessons, assets] = await Promise.all([
    db.lesson.findMany({
      where: {
        OR: [{ type: { contains: "video", mode: "insensitive" } }, { assetUri: { not: null } }],
      },
      orderBy: [{ updatedAt: "desc" }, { sortOrder: "asc" }],
      include: {
        section: {
          include: {
            course: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    }),
    db.contentAsset.findMany({
      where: {
        resourceType: "video",
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ])

  const groupedAssets = new Map<string, CmsAssetItem[]>()
  for (const asset of assets) {
    const key = asset.resourceId ?? ""
    if (!groupedAssets.has(key)) groupedAssets.set(key, [])
    groupedAssets.get(key)?.push(mapAsset(asset))
  }

  return lessons.map((lesson) => ({
    lessonId: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    type: lesson.type,
    status: lesson.status,
    isPreview: lesson.isPreview,
    courseTitle: lesson.section.course.title,
    sectionTitle: lesson.section.title,
    assetUri: lesson.assetUri,
    assets: groupedAssets.get(lesson.id) ?? [],
  }))
}

export async function listContentAssets(resourceType?: string, resourceId?: string): Promise<CmsAssetItem[]> {
  const assets = await db.contentAsset.findMany({
    where: {
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  })

  return assets.map(mapAsset)
}

export async function createContentAsset(input: CmsAssetCreateInput, operator: Operator) {
  const asset = await db.contentAsset.create({
    data: {
      assetType: input.assetType.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: "published",
      sourceUrl: input.sourceUrl.trim(),
      mimeType: input.mimeType?.trim() || null,
      durationSec: input.durationSec ?? null,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      resourceType: input.resourceType?.trim() || null,
      resourceId: input.resourceId?.trim() || null,
      uploaderId: operator.id,
    },
  })

  if (input.resourceType === "video" && input.resourceId) {
    await db.lesson.update({
      where: { id: input.resourceId },
      data: {
        assetUri: input.sourceUrl.trim(),
      },
    })
  }

  return mapAsset(asset)
}

export async function updateVideoLesson(id: string, input: CmsVideoUpdateInput) {
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!lesson) {
    throw new ContentCmsError("lesson_not_found", "视频内容不存在", 404)
  }

  await db.lesson.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      summary: input.summary?.trim() || null,
      type: input.type?.trim() || undefined,
      assetUri: input.assetUri?.trim() || null,
      isPreview: input.isPreview ?? undefined,
      status: input.status ? normalizeStatus(input.status) : undefined,
    },
  })
}

function mapPathListItem(set: {
  id: string
  slug: string | null
  title: string
  summary: string | null
  description: string | null
  kind: string
  status: string
  visibility: string
  updatedAt: Date
  _count: { items: number }
}): CmsPathListItem {
  return {
    id: set.id,
    slug: set.slug,
    title: set.title,
    summary: set.summary,
    description: set.description,
    kind: set.kind,
    status: set.status,
    visibility: set.visibility,
    itemCount: set._count.items,
    updatedAt: set.updatedAt.toISOString(),
  }
}

export async function listCmsPaths(): Promise<CmsPathListItem[]> {
  const sets = await db.problemSet.findMany({
    where: {
      kind: "training_path",
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })

  return sets.map(mapPathListItem)
}

export async function createCmsPath(input: {
  title: string
  slug?: string
  summary?: string
  description?: string
  visibility?: string
}, operator: Operator) {
  const created = await db.problemSet.create({
    data: {
      title: input.title.trim(),
      slug: input.slug?.trim() || slugify(input.title),
      summary: input.summary?.trim() || null,
      description: input.description?.trim() || null,
      kind: "training_path",
      status: "draft",
      visibility: input.visibility?.trim() || "public",
      ownerId: operator.id,
    },
    include: {
      _count: {
        select: { items: true },
      },
    },
  })

  return mapPathListItem(created)
}

export async function getCmsPathDetail(id: string): Promise<CmsPathDetail> {
  const [set, workflowLogs] = await Promise.all([
    db.problemSet.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { orderIndex: "asc" },
          include: {
            problem: {
              select: {
                id: true,
                slug: true,
                title: true,
                difficulty: true,
                tags: {
                  select: {
                    tag: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    listWorkflowLogs({ resourceType: "training_path", resourceId: id }),
  ])

  if (!set) {
    throw new ContentCmsError("path_not_found", "训练路径不存在", 404)
  }

  const tagHints = [...new Set(set.items.flatMap((item) => item.problem.tags.map((tag) => tag.tag.name)))]
  const [linkedProducts, suggestedProducts] = await Promise.all([
    listLinkedProductsForTargets({
      targets: [
        { type: "training_path", id: set.id },
        { type: "problem_set", id: set.id },
      ],
      tagHints,
      limit: 4,
    }),
    listLinkedProductsForTargets({
      targets: [],
      tagHints,
      limit: 4,
    }),
  ])

  return {
    ...mapPathListItem(set),
    items: set.items.map((item) => ({
      orderIndex: item.orderIndex,
      problem: {
        id: item.problem.id,
        slug: item.problem.slug,
        title: item.problem.title,
        difficulty: item.problem.difficulty,
        tags: item.problem.tags.map((tag) => tag.tag.name),
      },
    })),
    workflowLogs,
    linkedProducts,
    suggestedProducts,
  }
}

export async function updateCmsPath(id: string, input: CmsPathUpdateInput) {
  const existing = await db.problemSet.findUnique({
    where: { id },
    select: { id: true, title: true },
  })

  if (!existing) {
    throw new ContentCmsError("path_not_found", "训练路径不存在", 404)
  }

  const slug = input.slug?.trim() || undefined

  await db.problemSet.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      slug,
      summary: input.summary?.trim() || null,
      description: input.description?.trim() || null,
      visibility: input.visibility?.trim() || undefined,
      status: input.status ? normalizeStatus(input.status) : undefined,
      kind: input.kind?.trim() || undefined,
    },
  })
}

export async function replaceCmsPathItems(id: string, input: CmsPathBulkItemsInput) {
  const set = await db.problemSet.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!set) {
    throw new ContentCmsError("path_not_found", "训练路径不存在", 404)
  }

  const problemIds = [...new Set(input.items.map((item) => item.problemId))]
  const existingProblems = await db.problem.findMany({
    where: {
      id: { in: problemIds },
    },
    select: { id: true },
  })
  const existingProblemIds = new Set(existingProblems.map((item) => item.id))
  const missing = problemIds.filter((id) => !existingProblemIds.has(id))
  if (missing.length > 0) {
    throw new ContentCmsError("problem_not_found", `以下题目不存在：${missing.join(", ")}`, 404)
  }

  await db.$transaction(async (tx) => {
    await tx.problemSetItem.deleteMany({
      where: { setId: id },
    })

    if (input.items.length > 0) {
      await tx.problemSetItem.createMany({
        data: input.items.map((item) => ({
          setId: id,
          problemId: item.problemId,
          orderIndex: item.orderIndex,
        })),
      })
    }
  })
}

export async function transitionContentStatus(input: CmsStatusTransitionInput, operator: Operator) {
  const toStatus = normalizeStatus(input.toStatus)

  return db.$transaction(async (tx) => {
    const fromStatus = await getCurrentStatus(tx, input.resourceType, input.resourceId)
    if (fromStatus === toStatus) {
      return writeWorkflowLog(tx, {
        ...input,
        toStatus,
        fromStatus,
        action: "status_noop",
        operatorId: operator.id,
      })
    }

    await updateCurrentStatus(tx, input.resourceType, input.resourceId, toStatus)
    return writeWorkflowLog(tx, {
      ...input,
      toStatus,
      fromStatus,
      action: `status_${toStatus}`,
      operatorId: operator.id,
    })
  })
}

export async function listWorkflowLogs(query?: {
  resourceType?: CmsResourceType
  resourceId?: string
  limit?: number
}) {
  const logs = await db.contentWorkflowLog.findMany({
    where: {
      ...(query?.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query?.resourceId ? { resourceId: query.resourceId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: query?.limit ?? 50,
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return logs.map(mapWorkflowLog)
}
