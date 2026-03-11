import { db } from "@/lib/db"
import { ProblemLifecycleStatus, UserProblemStatus } from "@/lib/oj"
import {
  buildTrainingPathSlug,
  formatTrainingPathProgressRate,
  listTrainingPathDefinitions,
  resolveTrainingPathDefinition,
  type TrainingPathChapterDefinition,
  type TrainingPathChapterItem,
  type TrainingPathChapterProgress,
  type TrainingPathDetailItem,
  type TrainingPathDifficultySummary,
  type TrainingPathListItem,
  type TrainingPathProblemItem,
  type TrainingPathProblemStatus,
  type TrainingPathProgressPayload,
  type TrainingPathProgressSummary,
} from "@/lib/training-paths"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"

type AccessViewer = {
  id?: string | null
  roles?: string[]
}

type TrainingPathQuery = {
  q?: string | null
}

type ProblemRecord = {
  id: string
  slug: string
  title: string
  difficulty: number
  source: string | null
  tags: string[]
}

type MaterializedChapter = {
  id: string
  title: string
  summary: string
  sortOrder: number
  problems: ProblemRecord[]
}

type MaterializedPath = {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  visibility: TrainingPathDetailItem["visibility"]
  level: TrainingPathDetailItem["level"]
  difficultyBand: TrainingPathDetailItem["difficultyBand"]
  createdAt: string
  owner: TrainingPathDetailItem["owner"]
  chapters: MaterializedChapter[]
  itemCount: number
  difficultySummary: TrainingPathDifficultySummary
  topTags: string[]
}

type ProgressRow = {
  problemId: string
  status: number
  attempts: number
  bestScore: number
  solvedAt: Date | null
  updatedAt: Date
}

const SYSTEM_OWNER = {
  id: "system",
  name: "CodeMaster 教研",
}

function buildPublishedProblemWhere() {
  return {
    visible: true,
    defunct: "N",
    status: {
      gte: ProblemLifecycleStatus.PUBLISHED,
    },
    visibility: "public",
  }
}

function buildDifficultySummary(problems: ProblemRecord[]): TrainingPathDifficultySummary {
  if (problems.length === 0) {
    return {
      easy: 0,
      medium: 0,
      hard: 0,
      average: null,
    }
  }

  let easy = 0
  let medium = 0
  let hard = 0
  let total = 0

  for (const problem of problems) {
    if (problem.difficulty === 1) easy += 1
    else if (problem.difficulty === 2) medium += 1
    else hard += 1

    total += problem.difficulty
  }

  return {
    easy,
    medium,
    hard,
    average: Number((total / problems.length).toFixed(1)),
  }
}

function buildTopTags(problems: ProblemRecord[]) {
  const counter = new Map<string, number>()

  for (const problem of problems) {
    for (const tag of problem.tags) {
      counter.set(tag, (counter.get(tag) ?? 0) + 1)
    }
  }

  return [...counter.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0], "zh-CN")
    })
    .slice(0, 6)
    .map(([tag]) => tag)
}

async function resolveTagIds(aliases?: string[]) {
  const normalized = aliases?.map((item) => item.trim()).filter(Boolean) ?? []
  if (normalized.length === 0) return []

  const rows = await db.tag.findMany({
    where: {
      OR: normalized.map((name) => ({
        name: {
          equals: name,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
    },
  })

  return rows.map((row) => row.id)
}

function mapProblem(problem: {
  id: string
  slug: string
  title: string
  difficulty: number
  source: string | null
  tags: Array<{ tag: { name: string } }>
}): ProblemRecord {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    source: problem.source,
    tags: problem.tags.map((tag) => tag.tag.name),
  }
}

async function queryProblems(args: {
  chapter: TrainingPathChapterDefinition
  excludeIds: Set<string>
}) {
  const tagIds = await resolveTagIds(args.chapter.tagAliases)
  const fallbackTagIds = await resolveTagIds(args.chapter.fallbackTags)
  const baseWhere = buildPublishedProblemWhere()
  const commonFilter = {
    ...baseWhere,
    ...(args.chapter.difficultyMin ? { difficulty: { gte: args.chapter.difficultyMin } } : {}),
  } as {
    visible: boolean
    defunct: string
    status: { gte: number }
    visibility: string
    difficulty?: { gte?: number; lte?: number }
  }

  if (args.chapter.difficultyMin || args.chapter.difficultyMax) {
    commonFilter.difficulty = {
      ...(args.chapter.difficultyMin ? { gte: args.chapter.difficultyMin } : {}),
      ...(args.chapter.difficultyMax ? { lte: args.chapter.difficultyMax } : {}),
    }
  }

  const include = {
    tags: {
      select: {
        tag: {
          select: {
            name: true,
          },
        },
      },
    },
  }

  const orderBy = [{ difficulty: "asc" as const }, { acceptedSubmissions: "desc" as const }, { createdAt: "asc" as const }]
  const take = Math.max(args.chapter.take * 3, args.chapter.take)

  const primary = await db.problem.findMany({
    where: {
      ...commonFilter,
      ...(args.excludeIds.size > 0 ? { id: { notIn: [...args.excludeIds] } } : {}),
      ...(tagIds.length > 0
        ? {
            tags: {
              some: {
                tagId: {
                  in: tagIds,
                },
              },
            },
          }
        : {}),
    },
    include,
    orderBy,
    take,
  })

  const picked = new Map<string, ProblemRecord>()
  for (const problem of primary) {
    if (picked.size >= args.chapter.take) break
    picked.set(problem.id, mapProblem(problem))
  }

  if (picked.size < args.chapter.take) {
    const fallback = await db.problem.findMany({
      where: {
        ...commonFilter,
        ...(args.excludeIds.size > 0 ? { id: { notIn: [...args.excludeIds] } } : {}),
        ...(fallbackTagIds.length > 0
          ? {
              tags: {
                some: {
                  tagId: {
                    in: fallbackTagIds,
                  },
                },
              },
            }
          : {}),
      },
      include,
      orderBy,
      take,
    })

    for (const problem of fallback) {
      if (picked.size >= args.chapter.take) break
      if (!picked.has(problem.id)) {
        picked.set(problem.id, mapProblem(problem))
      }
    }
  }

  if (picked.size < args.chapter.take) {
    const generic = await db.problem.findMany({
      where: {
        ...commonFilter,
        ...(args.excludeIds.size > 0 ? { id: { notIn: [...args.excludeIds] } } : {}),
      },
      include,
      orderBy,
      take,
    })

    for (const problem of generic) {
      if (picked.size >= args.chapter.take) break
      if (!picked.has(problem.id)) {
        picked.set(problem.id, mapProblem(problem))
      }
    }
  }

  return [...picked.values()]
}

async function materializePath(idOrSlug: string) {
  const definition = resolveTrainingPathDefinition(idOrSlug)
  if (!definition) return null

  const excludedIds = new Set<string>()
  const chapters: MaterializedChapter[] = []

  for (const [index, chapter] of definition.chapters.entries()) {
    const problems = await queryProblems({
      chapter,
      excludeIds: excludedIds,
    })

    for (const problem of problems) {
      excludedIds.add(problem.id)
    }

    chapters.push({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      sortOrder: index,
      problems,
    })
  }

  const allProblems = chapters.flatMap((chapter) => chapter.problems)

  return {
    id: definition.id,
    slug: buildTrainingPathSlug(definition.id, definition.title),
    title: definition.title,
    summary: definition.summary,
    description: definition.description,
    visibility: definition.visibility,
    level: definition.level,
    difficultyBand: definition.difficultyBand,
    createdAt: new Date("2026-03-11T00:00:00.000Z").toISOString(),
    owner: SYSTEM_OWNER,
    chapters,
    itemCount: allProblems.length,
    difficultySummary: buildDifficultySummary(allProblems),
    topTags: buildTopTags(allProblems),
  } satisfies MaterializedPath
}

function mapProblemItem(problem: ProblemRecord, orderIndex: number): TrainingPathProblemItem {
  return {
    orderIndex,
    problem: {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      source: problem.source,
      tags: problem.tags,
    },
  }
}

function buildDetailChapters(materialized: MaterializedPath, accessAllowed: boolean): TrainingPathChapterItem[] {
  return materialized.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    summary: chapter.summary,
    sortOrder: chapter.sortOrder,
    problemCount: chapter.problems.length,
    difficultySummary: buildDifficultySummary(chapter.problems),
    problems: accessAllowed ? chapter.problems.map(mapProblemItem) : [],
  }))
}

function resolveProblemStatus(progress: ProgressRow | undefined): TrainingPathProblemStatus {
  if (!progress) return "not_started"
  if (progress.status >= UserProblemStatus.ACCEPTED || progress.solvedAt) return "solved"
  if (progress.status >= UserProblemStatus.ATTEMPTED || progress.attempts > 0) return "attempted"
  return "not_started"
}

async function loadProgressRows(userId: string, problemIds: string[]) {
  if (problemIds.length === 0) return new Map<string, ProgressRow>()

  const rows = await db.userProblemProgress.findMany({
    where: {
      userId,
      problemId: {
        in: problemIds,
      },
    },
    select: {
      problemId: true,
      status: true,
      attempts: true,
      bestScore: true,
      solvedAt: true,
      updatedAt: true,
    },
  })

  return new Map(rows.map((row) => [row.problemId, row]))
}

function buildProgressSummary(
  materialized: MaterializedPath,
  progressMap: Map<string, ProgressRow>,
): {
  summary: TrainingPathProgressSummary
  chapters: TrainingPathChapterProgress[]
} {
  let totalProblems = 0
  let completedProblems = 0
  let attemptedProblems = 0
  let currentChapterId: string | null = null
  let currentProblemId: string | null = null
  let lastLearningPosition: TrainingPathProgressSummary["lastLearningPosition"] = null
  let latestTimestamp = 0

  const chapterProgress = materialized.chapters.map((chapter) => {
    let chapterCompleted = 0
    let chapterAttempted = 0
    let chapterCurrentProblemId: string | null = null

    const problemProgress = chapter.problems.map((problem) => {
      const row = progressMap.get(problem.id)
      const status = resolveProblemStatus(row)

      totalProblems += 1
      if (status === "solved") {
        completedProblems += 1
        chapterCompleted += 1
      } else if (status === "attempted") {
        attemptedProblems += 1
        chapterAttempted += 1
      }

      if (!chapterCurrentProblemId && status !== "solved") {
        chapterCurrentProblemId = problem.id
      }

      if (row?.updatedAt) {
        const timestamp = row.updatedAt.getTime()
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp
          lastLearningPosition = {
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            problemId: problem.id,
            problemSlug: problem.slug,
            problemTitle: problem.title,
            updatedAt: row.updatedAt.toISOString(),
          }
        }
      }

      return {
        problemId: problem.id,
        status,
        attempts: row?.attempts ?? 0,
        bestScore: row?.bestScore ?? 0,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
        solvedAt: row?.solvedAt?.toISOString() ?? null,
      }
    })

    if (!currentChapterId && chapterCurrentProblemId) {
      currentChapterId = chapter.id
      currentProblemId = chapterCurrentProblemId
    }

    return {
      id: chapter.id,
      title: chapter.title,
      totalProblems: chapter.problems.length,
      completedProblems: chapterCompleted,
      attemptedProblems: chapterAttempted,
      completionRate:
        chapter.problems.length > 0 ? Number((chapterCompleted / chapter.problems.length).toFixed(4)) : 0,
      currentProblemId: chapterCurrentProblemId,
      problems: problemProgress,
    } satisfies TrainingPathChapterProgress
  })

  if (!currentChapterId) {
    currentChapterId = materialized.chapters.find((chapter) => chapter.problems.length > 0)?.id ?? null
    currentProblemId = materialized.chapters.find((chapter) => chapter.problems.length > 0)?.problems[0]?.id ?? null
  }

  return {
    summary: {
      totalProblems,
      completedProblems,
      attemptedProblems,
      completionRate: totalProblems > 0 ? Number((completedProblems / totalProblems).toFixed(4)) : 0,
      currentChapterId,
      currentProblemId,
      lastLearningPosition,
    },
    chapters: chapterProgress,
  }
}

function mapListItem(
  materialized: MaterializedPath,
  access: Awaited<ReturnType<Awaited<ReturnType<typeof createContentAccessEvaluator>>["canAccessTrainingPath"]>>,
  progress: TrainingPathProgressSummary | null,
): TrainingPathListItem {
  return {
    id: materialized.id,
    slug: materialized.slug,
    title: materialized.title,
    summary: materialized.summary,
    description: materialized.description,
    visibility: materialized.visibility,
    level: materialized.level,
    difficultyBand: materialized.difficultyBand,
    createdAt: materialized.createdAt,
    owner: materialized.owner,
    chapterCount: materialized.chapters.length,
    itemCount: materialized.itemCount,
    topTags: materialized.topTags,
    difficultySummary: materialized.difficultySummary,
    previewChapters: materialized.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      problemCount: chapter.problems.length,
    })),
    locked: !access.allowed,
    access,
    progress,
  }
}

export async function listTrainingPaths(query: TrainingPathQuery, viewer?: AccessViewer) {
  const evaluator = await createContentAccessEvaluator(viewer)
  const definitions = listTrainingPathDefinitions(query.q)
  const paths = await Promise.all(definitions.map((item) => materializePath(item.id)))
  const materialized = paths.reduce<MaterializedPath[]>((rows, item) => {
    if (item) rows.push(item)
    return rows
  }, [])

  const progressByPath =
    viewer?.id
      ? new Map(
          (
            await Promise.all(
              materialized.map(async (path) => {
                const problemIds = path.chapters.flatMap((chapter) => chapter.problems.map((problem) => problem.id))
                const progressMap = await loadProgressRows(viewer.id!, problemIds)
                return [path.id, buildProgressSummary(path, progressMap).summary] as const
              }),
            )
          ).map(([id, progress]) => [id, progress]),
        )
      : new Map<string, TrainingPathProgressSummary>()

  const items = await Promise.all(
    materialized.map(async (path) =>
      mapListItem(
        path,
        await evaluator.canAccessTrainingPath({
          id: path.id,
          visibility: path.visibility,
        }),
        progressByPath.get(path.id) ?? null,
      ),
    ),
  )

  return {
    items,
    total: items.length,
    q: query.q?.trim() ?? "",
  }
}

export async function getTrainingPathDetail(idOrSlug: string, viewer?: AccessViewer): Promise<TrainingPathDetailItem | null> {
  const [materialized, evaluator] = await Promise.all([materializePath(idOrSlug), createContentAccessEvaluator(viewer)])
  if (!materialized) return null

  const access = await evaluator.canAccessTrainingPath({
    id: materialized.id,
    visibility: materialized.visibility,
  })

  const progress =
    viewer?.id && access.allowed
      ? buildProgressSummary(
          materialized,
          await loadProgressRows(
            viewer.id,
            materialized.chapters.flatMap((chapter) => chapter.problems.map((problem) => problem.id)),
          ),
        ).summary
      : null

  return {
    ...mapListItem(materialized, access, progress),
    chapters: buildDetailChapters(materialized, access.allowed),
  }
}

export async function getTrainingPathProgress(
  idOrSlug: string,
  viewer?: AccessViewer,
): Promise<TrainingPathProgressPayload | null> {
  const [materialized, evaluator] = await Promise.all([materializePath(idOrSlug), createContentAccessEvaluator(viewer)])
  if (!materialized) return null

  const access = await evaluator.canAccessTrainingPath({
    id: materialized.id,
    visibility: materialized.visibility,
  })

  if (!viewer?.id) {
    return {
      pathId: materialized.id,
      locked: !access.allowed,
      access,
      summary: null,
      chapters: materialized.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        totalProblems: chapter.problems.length,
        completedProblems: 0,
        attemptedProblems: 0,
        completionRate: 0,
        currentProblemId: chapter.problems[0]?.id ?? null,
        problems: chapter.problems.map((problem) => ({
          problemId: problem.id,
          status: "not_started",
          attempts: 0,
          bestScore: 0,
          updatedAt: null,
          solvedAt: null,
        })),
      })),
    }
  }

  if (!access.allowed) {
    return {
      pathId: materialized.id,
      locked: true,
      access,
      summary: null,
      chapters: materialized.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        totalProblems: chapter.problems.length,
        completedProblems: 0,
        attemptedProblems: 0,
        completionRate: 0,
        currentProblemId: null,
        problems: [],
      })),
    }
  }

  const progressMap = await loadProgressRows(
    viewer.id,
    materialized.chapters.flatMap((chapter) => chapter.problems.map((problem) => problem.id)),
  )
  const progress = buildProgressSummary(materialized, progressMap)

  return {
    pathId: materialized.id,
    locked: !access.allowed,
    access,
    summary: progress.summary,
    chapters: progress.chapters,
  }
}

export async function syncTrainingPathProgress(
  idOrSlug: string,
  viewer?: AccessViewer,
): Promise<TrainingPathProgressPayload | null> {
  return getTrainingPathProgress(idOrSlug, viewer)
}

export function formatProgressRate(value: number) {
  return formatTrainingPathProgressRate(value)
}
