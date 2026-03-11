import { db } from "@/lib/db"
import {
  parseContentPackIncludedTargets,
  type ContentPackDetailItem,
  type ContentPackIncludedItem,
  type ContentPackListItem,
} from "@/lib/content-packs"
import { formatContentAccessRequirement, type ContentAccessResult } from "@/lib/content-access"
import type { ProductListQuery } from "@/server/modules/product-center/schemas"
import { getPublicProductDetail, listPublicProducts } from "@/server/modules/product-center/service"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import { getTrainingPathDetail } from "@/server/modules/training-path-center/service"

type Viewer = {
  id?: string | null
  roles?: string[]
}

function buildPreviewText(content: string | null | undefined, limit = 160) {
  if (!content) return null

  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return null
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text
}

function buildAccessMetaLabel(access?: ContentAccessResult | null) {
  if (!access) return null
  return access.allowed ? "已解锁" : formatContentAccessRequirement(access.policy.requiredSources)
}

async function resolveTrainingPathItem(
  target: ReturnType<typeof parseContentPackIncludedTargets>[number],
  viewer?: Viewer,
) {
  const detail = await getTrainingPathDetail(target.id, viewer)

  if (!detail) {
    return {
      type: target.type,
      id: target.id,
      title: target.title || "训练路径待补充",
      summary: target.summary || target.note || "当前路径尚未发布或配置不完整。",
      note: target.note ?? null,
      href: null,
      meta: "训练路径",
      locked: true,
      access: null,
    } satisfies ContentPackIncludedItem
  }

  return {
    type: target.type,
    id: target.id,
    title: detail.title,
    summary: detail.summary,
    note: target.note ?? null,
    href: `/training-paths/${detail.slug}`,
    meta: `${detail.chapterCount} 章 · ${detail.itemCount} 题`,
    locked: detail.locked,
    access: detail.access,
  } satisfies ContentPackIncludedItem
}

async function resolveSolutionItem(
  evaluator: Awaited<ReturnType<typeof createContentAccessEvaluator>>,
  target: ReturnType<typeof parseContentPackIncludedTargets>[number],
) {
  const solution = await db.solution.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      problemId: true,
      title: true,
      summary: true,
      content: true,
      visibility: true,
      accessLevel: true,
      isPremium: true,
      status: true,
      problem: {
        select: {
          slug: true,
          title: true,
        },
      },
    },
  })

  if (!solution || solution.status !== "published") {
    return {
      type: target.type,
      id: target.id,
      title: target.title || "高级题解待发布",
      summary: target.summary || target.note || "当前题解尚未发布。",
      note: target.note ?? null,
      href: null,
      meta: "高级题解",
      locked: true,
      access: null,
    } satisfies ContentPackIncludedItem
  }

  const access = await evaluator.canAccessSolution({
    id: solution.id,
    problemId: solution.problemId,
    visibility: solution.visibility,
    accessLevel: solution.accessLevel,
    isPremium: solution.isPremium,
  })

  return {
    type: target.type,
    id: target.id,
    title: solution.title,
    summary: solution.summary || buildPreviewText(solution.content) || target.summary || null,
    note: target.note ?? null,
    href: `/problems/${solution.problem.slug}`,
    meta: `题目：${solution.problem.title}`,
    locked: !access.allowed,
    access,
  } satisfies ContentPackIncludedItem
}

async function resolveVideoItem(
  evaluator: Awaited<ReturnType<typeof createContentAccessEvaluator>>,
  target: ReturnType<typeof parseContentPackIncludedTargets>[number],
) {
  const lesson = await db.lesson.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      status: true,
      isPreview: true,
      durationSec: true,
      section: {
        select: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
            },
          },
        },
      },
    },
  })

  if (!lesson || lesson.status !== "published") {
    return {
      type: target.type,
      id: target.id,
      title: target.title || "视频解析待发布",
      summary: target.summary || target.note || "当前视频解析尚未发布。",
      note: target.note ?? null,
      href: null,
      meta: "视频解析",
      locked: true,
      access: null,
    } satisfies ContentPackIncludedItem
  }

  const access = await evaluator.canAccessVideo({
    id: lesson.id,
    courseId: lesson.section.course.id,
    isPreview: lesson.isPreview,
  })

  const durationMinutes =
    lesson.durationSec && lesson.durationSec > 0 ? `${Math.max(Math.round(lesson.durationSec / 60), 1)} 分钟` : null

  return {
    type: target.type,
    id: target.id,
    title: lesson.title,
    summary: lesson.summary || buildPreviewText(lesson.content) || target.summary || null,
    note: target.note ?? null,
    href: `/learn/${lesson.section.course.slug}?lesson=${lesson.slug}`,
    meta: durationMinutes ? `${lesson.section.course.title} · ${durationMinutes}` : lesson.section.course.title,
    locked: !access.allowed,
    access,
  } satisfies ContentPackIncludedItem
}

async function resolveProblemItem(target: ReturnType<typeof parseContentPackIncludedTargets>[number]) {
  const problem = await db.problem.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      source: true,
    },
  })

  if (!problem) {
    return {
      type: target.type,
      id: target.id,
      title: target.title || "练习题待补充",
      summary: target.summary || target.note || "当前练习题配置不完整。",
      note: target.note ?? null,
      href: null,
      meta: "练习题",
      locked: false,
      access: null,
    } satisfies ContentPackIncludedItem
  }

  return {
    type: target.type,
    id: target.id,
    title: problem.title,
    summary: target.summary || (problem.source ? `来源：${problem.source}` : "精选练习题"),
    note: target.note ?? null,
    href: `/problems/${problem.slug}`,
    meta: problem.difficulty ? `难度 ${problem.difficulty}` : "练习题",
    locked: false,
    access: null,
  } satisfies ContentPackIncludedItem
}

async function resolveProblemSetItem(
  evaluator: Awaited<ReturnType<typeof createContentAccessEvaluator>>,
  target: ReturnType<typeof parseContentPackIncludedTargets>[number],
) {
  const set = await db.problemSet.findUnique({
    where: { id: target.id },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      status: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  })

  if (!set || set.status !== "published") {
    return {
      type: target.type,
      id: target.id,
      title: target.title || "专项题单待发布",
      summary: target.summary || target.note || "当前专项题单尚未发布。",
      note: target.note ?? null,
      href: null,
      meta: "专项题单",
      locked: true,
      access: null,
    } satisfies ContentPackIncludedItem
  }

  const access = await evaluator.canAccessProblemSet({
    id: set.id,
    visibility: set.visibility,
  })

  return {
    type: target.type,
    id: target.id,
    title: set.title,
    summary: set.description || target.summary || null,
    note: target.note ?? null,
    href: null,
    meta: `${set._count.items} 道题`,
    locked: !access.allowed,
    access,
  } satisfies ContentPackIncludedItem
}

async function resolveIncludedItem(
  evaluator: Awaited<ReturnType<typeof createContentAccessEvaluator>>,
  target: ReturnType<typeof parseContentPackIncludedTargets>[number],
  viewer?: Viewer,
) {
  switch (target.type) {
    case "training_path":
      return resolveTrainingPathItem(target, viewer)
    case "solution":
      return resolveSolutionItem(evaluator, target)
    case "video":
      return resolveVideoItem(evaluator, target)
    case "problem":
      return resolveProblemItem(target)
    case "problem_set":
      return resolveProblemSetItem(evaluator, target)
  }
}

function mapContentPackListItem(product: Awaited<ReturnType<typeof getPublicProductDetail>>): ContentPackListItem {
  const previewTargets = parseContentPackIncludedTargets(product.metadata, {
    targetType: product.targetType,
    targetId: product.targetId,
  }).slice(0, 4)

  return {
    ...product,
    includedTargetCount: previewTargets.length,
    previewTargets: previewTargets.map((target) => ({
      type: target.type,
      id: target.id,
      title: target.title || target.id,
      summary: target.summary ?? null,
      note: target.note ?? null,
      href: null,
      meta: null,
      locked: true,
      access: null,
    })),
  }
}

export async function listContentPacks(query: Omit<ProductListQuery, "type">) {
  const payload = await listPublicProducts({
    ...query,
    type: "content_pack",
  })

  const details = await Promise.all(payload.data.map((product) => getPublicProductDetail(product.id)))

  return {
    data: details.map(mapContentPackListItem),
    meta: payload.meta,
  }
}

export async function getContentPackDetail(idOrSlug: string, viewer?: Viewer): Promise<ContentPackDetailItem> {
  const [product, evaluator] = await Promise.all([
    getPublicProductDetail(idOrSlug),
    createContentAccessEvaluator(viewer),
  ])

  if (product.type !== "content_pack") {
    throw new Error("content_pack_not_found")
  }

  const includedTargets = parseContentPackIncludedTargets(product.metadata, {
    targetType: product.targetType,
    targetId: product.targetId,
  })

  const resolvedTargets = await Promise.all(
    includedTargets.map((target) => resolveIncludedItem(evaluator, target, viewer)),
  )

  return {
    product,
    includedTargets: resolvedTargets.map((item) => ({
      ...item,
      meta: item.meta || buildAccessMetaLabel(item.access),
    })),
  }
}
