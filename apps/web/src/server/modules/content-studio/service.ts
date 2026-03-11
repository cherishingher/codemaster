import { db } from "@/lib/db"
import type {
  ContentStudioOverviewPayload,
  ContentStudioSolutionItem,
  ContentStudioSolutionUpdateInput,
  ContentStudioTrainingPathItem,
  ContentStudioVideoItem,
  ContentStudioVideoUpdateInput,
} from "@/lib/content-studio"
import { listLinkedProductsForTargets } from "@/server/modules/recommendation-center/service"
import { listTrainingPaths } from "@/server/modules/training-path-center/service"

export class ContentStudioError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function normalizeVisibility(value?: string | null) {
  return value?.trim() || "public"
}

function normalizeAccessLevel(value?: string | null) {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null

  if (["FREE", "MEMBERSHIP", "PURCHASE", "MEMBERSHIP_OR_PURCHASE"].includes(normalized)) {
    return normalized
  }

  throw new ContentStudioError("invalid_access_level", "accessLevel 不合法", 400)
}

function normalizeTags(value: string[]) {
  return value.map((item) => item.trim()).filter(Boolean)
}

async function mapSolutionItem(solution: {
  id: string
  title: string
  summary: string | null
  visibility: string
  accessLevel: string | null
  isPremium: boolean
  videoUrl: string | null
  createdAt: Date
  problem: {
    id: string
    slug: string
    title: string
    tags: Array<{ tag: { name: string } }>
  }
}): Promise<ContentStudioSolutionItem> {
  const tagHints = normalizeTags(solution.problem.tags.map((item) => item.tag.name))
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
    resourceType: "solution",
    id: solution.id,
    title: solution.title,
    summary: solution.summary,
    visibility: solution.visibility,
    accessLevel: solution.accessLevel,
    linkedProducts,
    suggestedProducts,
    problemId: solution.problem.id,
    problemSlug: solution.problem.slug,
    problemTitle: solution.problem.title,
    hasVideo: Boolean(solution.videoUrl),
    videoUrl: solution.videoUrl,
    isPremium: solution.isPremium,
    createdAt: solution.createdAt.toISOString(),
  }
}

async function mapVideoItem(lesson: {
  id: string
  title: string
  summary: string | null
  type: string
  assetUri: string | null
  thumbnailUrl: string | null
  isPreview: boolean
  section: {
    id: string
    title: string
    course: {
      id: string
      title: string
      category: string | null
    }
  }
}): Promise<ContentStudioVideoItem> {
  const tagHints = normalizeTags([lesson.section.course.category ?? lesson.type].filter(Boolean))
  const [linkedProducts, suggestedProducts] = await Promise.all([
    listLinkedProductsForTargets({
      targets: [
        { type: "video", id: lesson.id },
        { type: "lesson", id: lesson.id },
        { type: "course", id: lesson.section.course.id },
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
    resourceType: "video",
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    visibility: lesson.isPreview ? "public" : "membership_or_purchase",
    accessLevel: lesson.isPreview ? "FREE" : "MEMBERSHIP_OR_PURCHASE",
    linkedProducts,
    suggestedProducts,
    courseId: lesson.section.course.id,
    courseTitle: lesson.section.course.title,
    sectionId: lesson.section.id,
    sectionTitle: lesson.section.title,
    type: lesson.type,
    isPreview: lesson.isPreview,
    assetUri: lesson.assetUri,
  }
}

async function mapTrainingPathItem(path: Awaited<ReturnType<typeof listTrainingPaths>>["items"][number]): Promise<ContentStudioTrainingPathItem> {
  const [linkedProducts, suggestedProducts] = await Promise.all([
    listLinkedProductsForTargets({
      targets: [
        { type: "training_path", id: path.id },
        { type: "problem_set", id: path.id },
      ],
      tagHints: path.topTags,
      limit: 4,
    }),
    listLinkedProductsForTargets({
      targets: [],
      tagHints: path.topTags,
      limit: 4,
    }),
  ])

  return {
    resourceType: "training_path",
    id: path.id,
    slug: path.slug,
    title: path.title,
    summary: path.summary,
    visibility: path.visibility,
    accessLevel: path.access.visibility ?? path.visibility,
    linkedProducts,
    suggestedProducts,
    chapterCount: path.chapterCount,
    difficultyBand: path.difficultyBand,
    topTags: path.topTags,
    previewChapters: path.previewChapters,
  }
}

export async function getContentStudioOverview(): Promise<ContentStudioOverviewPayload> {
  const [solutions, lessons, paths] = await Promise.all([
    db.solution.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            tags: {
              select: {
                tag: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 40,
    }),
    db.lesson.findMany({
      where: {
        OR: [{ type: { contains: "video", mode: "insensitive" } }, { assetUri: { not: null } }],
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        section: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                category: true,
              },
            },
          },
        },
      },
      take: 40,
    }),
    listTrainingPaths({ q: null }, { roles: ["admin"] }),
  ])

  return {
    solutions: await Promise.all(solutions.map(mapSolutionItem)),
    videos: await Promise.all(lessons.map(mapVideoItem)),
    trainingPaths: await Promise.all(paths.items.map(mapTrainingPathItem)),
  }
}

export async function updateSolutionStudioItem(id: string, input: ContentStudioSolutionUpdateInput) {
  const solution = await db.solution.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!solution) {
    throw new ContentStudioError("solution_not_found", "题解不存在", 404)
  }

  await db.solution.update({
    where: { id },
    data: {
      summary: input.summary?.trim() || null,
      visibility: normalizeVisibility(input.visibility),
      accessLevel: normalizeAccessLevel(input.accessLevel),
      isPremium: input.isPremium ?? undefined,
      videoUrl: input.videoUrl?.trim() || null,
    },
  })
}

export async function updateVideoStudioItem(id: string, input: ContentStudioVideoUpdateInput) {
  const lesson = await db.lesson.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!lesson) {
    throw new ContentStudioError("lesson_not_found", "视频内容不存在", 404)
  }

  await db.lesson.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      summary: input.summary?.trim() || null,
      type: input.type?.trim() || undefined,
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      assetUri: input.assetUri?.trim() || null,
      isPreview: input.isPreview ?? undefined,
    },
  })
}
