import { UserProblemStatus } from "@/lib/oj"
import { db } from "@/lib/db"
import type {
  LearningReportData,
  LearningReportDifficultyBreakdown,
  LearningReportEmptyState,
  LearningReportOverview,
  LearningReportOverviewPayload,
  LearningReportPathItem,
  LearningReportPreview,
  LearningReportScope,
  LearningReportTagItem,
  LearningReportTrendPoint,
  LearningReportTrendsPayload,
  LearningReportWeeklyPayload,
  LearningReportWindow,
} from "@/lib/learning-reports"
import { LEARNING_REPORT_WINDOW_DAYS } from "@/lib/learning-reports"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import { listTrainingPaths } from "@/server/modules/training-path-center/service"

type AccessViewer = {
  id?: string | null
  roles?: string[]
}

type ProgressRow = {
  problemId: string
  status: number
  attempts: number
  solvedAt: Date | null
  updatedAt: Date
}

type SubmissionRow = {
  problemId: string
  createdAt: Date
  status: string
}

type ProblemRow = {
  id: string
  title: string
  difficulty: number
  tags: Array<{ tag: { name: string } }>
}

type LearningWindowData = {
  window: LearningReportWindow
  overview: LearningReportOverview
  solvedBreakdown: LearningReportDifficultyBreakdown
  tagDistribution: LearningReportTagItem[]
  trend: LearningReportTrendPoint[]
  trainingPaths: LearningReportPathItem[]
  nextStepAdvice: string[]
  emptyState: LearningReportEmptyState | null
}

function normalizeScope(value: string): LearningReportScope {
  return value === "basic" ? "basic" : "enhanced"
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWindowRange(days = LEARNING_REPORT_WINDOW_DAYS): LearningReportWindow {
  const endAt = new Date()
  const startAt = new Date(endAt)
  startAt.setHours(0, 0, 0, 0)
  startAt.setDate(startAt.getDate() - (days - 1))

  return {
    days,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  }
}

function isAcceptedStatus(status: string) {
  const normalized = status.toUpperCase()
  return normalized === "ACCEPTED" || normalized === "AC" || normalized === "PARTIAL"
}

function isSolvedInWindow(
  row: Pick<ProgressRow, "status" | "solvedAt" | "updatedAt">,
  windowStart: Date,
) {
  if (row.solvedAt) {
    return row.solvedAt >= windowStart
  }

  return row.status >= UserProblemStatus.ACCEPTED && row.updatedAt >= windowStart
}

function buildOverview(args: {
  attemptedProblemIds: Set<string>
  solvedProblemIds: Set<string>
  submissions: SubmissionRow[]
}): LearningReportOverview {
  const { attemptedProblemIds, solvedProblemIds, submissions } = args
  const uniqueActiveDays = new Set(submissions.map((row) => formatLocalDateKey(row.createdAt)))
  const sortedDays = [...uniqueActiveDays].sort()

  let longestStreak = 0
  let currentStreak = 0
  let rolling = 0

  for (let index = 0; index < sortedDays.length; index += 1) {
    const current = new Date(`${sortedDays[index]}T00:00:00`)
    const prev = index > 0 ? new Date(`${sortedDays[index - 1]}T00:00:00`) : null
    const isContinuous = prev ? current.getTime() - prev.getTime() === 24 * 60 * 60 * 1000 : false
    rolling = isContinuous ? rolling + 1 : 1
    longestStreak = Math.max(longestStreak, rolling)
  }

  if (sortedDays.length > 0) {
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const activeDaySet = new Set(sortedDays)

    while (activeDaySet.has(formatLocalDateKey(cursor))) {
      currentStreak += 1
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
    }
  }

  return {
    totalSubmissions: submissions.length,
    attemptedProblems: attemptedProblemIds.size,
    solvedProblems: solvedProblemIds.size,
    acceptedRate:
      attemptedProblemIds.size > 0 ? Number((solvedProblemIds.size / attemptedProblemIds.size).toFixed(4)) : 0,
    totalAttempts: submissions.length,
    activeDays: uniqueActiveDays.size,
    currentStreak,
    longestStreak,
    lastSubmissionAt: submissions[0]?.createdAt.toISOString() ?? null,
  }
}

function buildDifficultyBreakdown(problemRows: ProblemRow[], solvedProblemIds: Set<string>): LearningReportDifficultyBreakdown {
  return {
    easy: problemRows.filter((row) => solvedProblemIds.has(row.id) && row.difficulty === 1).length,
    medium: problemRows.filter((row) => solvedProblemIds.has(row.id) && row.difficulty === 2).length,
    hard: problemRows.filter((row) => solvedProblemIds.has(row.id) && row.difficulty >= 3).length,
  }
}

function buildTagStats(args: {
  problemRows: ProblemRow[]
  attemptedProblemIds: Set<string>
  solvedProblemIds: Set<string>
}): LearningReportTagItem[] {
  const { problemRows, attemptedProblemIds, solvedProblemIds } = args
  const counter = new Map<string, { attempted: number; solved: number }>()

  for (const row of problemRows) {
    const attempted = attemptedProblemIds.has(row.id)
    const solved = solvedProblemIds.has(row.id)
    if (!attempted && !solved) continue
    const tags = row.tags.map((item) => item.tag.name)
    for (const tag of tags) {
      const current = counter.get(tag) ?? { attempted: 0, solved: 0 }
      if (attempted) current.attempted += 1
      if (solved) current.solved += 1
      counter.set(tag, current)
    }
  }

  return [...counter.entries()]
    .map(([tag, value]) => ({
      tag,
      attemptedProblems: value.attempted,
      solvedProblems: value.solved,
      completionRate: value.attempted > 0 ? Number((value.solved / value.attempted).toFixed(4)) : 0,
    }))
    .sort((a, b) => {
      if (b.attemptedProblems !== a.attemptedProblems) return b.attemptedProblems - a.attemptedProblems
      if (b.solvedProblems !== a.solvedProblems) return b.solvedProblems - a.solvedProblems
      return a.tag.localeCompare(b.tag, "zh-CN")
    })
}

function buildTrend(submissions: SubmissionRow[], days = LEARNING_REPORT_WINDOW_DAYS): LearningReportTrendPoint[] {
  const buckets = new Map<string, { submissions: number; accepted: number }>()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    buckets.set(formatLocalDateKey(date), { submissions: 0, accepted: 0 })
  }

  for (const submission of submissions) {
    const key = formatLocalDateKey(submission.createdAt)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.submissions += 1
    if (isAcceptedStatus(submission.status)) bucket.accepted += 1
  }

  return [...buckets.entries()].map(([date, value]) => ({
    date,
    submissions: value.submissions,
    accepted: value.accepted,
  }))
}

function buildPathItems(items: Awaited<ReturnType<typeof listTrainingPaths>>["items"]): LearningReportPathItem[] {
  const mapped = items.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    locked: item.locked,
    requiredSources: item.access.policy.requiredSources,
    completionRate: item.progress?.completionRate ?? 0,
    completedProblems: item.progress?.completedProblems ?? 0,
    totalProblems: item.progress?.totalProblems ?? item.itemCount,
    currentChapterTitle:
      item.progress?.currentChapterId
        ? item.previewChapters.find((chapter) => chapter.id === item.progress?.currentChapterId)?.title ?? null
        : null,
    currentProblemTitle: item.progress?.lastLearningPosition?.problemTitle ?? null,
    lastLearningPositionTitle: item.progress?.lastLearningPosition?.problemTitle ?? null,
  }))

  return mapped.sort((a, b) => {
    const aStarted = a.completedProblems > 0 || Boolean(a.lastLearningPositionTitle)
    const bStarted = b.completedProblems > 0 || Boolean(b.lastLearningPositionTitle)
    if (aStarted !== bStarted) return aStarted ? -1 : 1
    if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate
    return a.title.localeCompare(b.title, "zh-CN")
  })
}

function buildNextStepAdvice(args: {
  overview: LearningReportOverview
  breakdown: LearningReportDifficultyBreakdown
  tags: LearningReportTagItem[]
  paths: LearningReportPathItem[]
}) {
  const advice: string[] = []

  if (args.overview.activeDays === 0) {
    advice.push("最近 7 天还没有训练记录，建议先从入门路径恢复节奏。")
  } else if (args.overview.activeDays < 3) {
    advice.push("最近活跃天数偏少，先把每周至少 3 天训练节奏稳定下来。")
  }

  const activePath = args.paths.find((item) => !item.locked && item.completionRate > 0 && item.completionRate < 1)
  if (activePath) {
    advice.push(`继续推进「${activePath.title}」，当前完成度 ${Math.round(activePath.completionRate * 100)}%。`)
  }

  const weakestTag = [...args.tags]
    .filter((item) => item.attemptedProblems >= 2)
    .sort((a, b) => a.completionRate - b.completionRate)[0]
  if (weakestTag) {
    advice.push(`标签「${weakestTag.tag}」通过率偏低，建议优先做同标签的 2-3 道巩固题。`)
  }

  if (args.breakdown.medium > 0 && args.breakdown.hard === 0) {
    advice.push("本周已经积累了一批中等题，可以开始加入少量高难题做突破。")
  }

  if (advice.length === 0) {
    advice.push("最近 7 天训练比较稳定，可以继续沿当前路径推进并保持复盘。")
  }

  return advice.slice(0, 4)
}

function buildEmptyState(overview: LearningReportOverview): LearningReportEmptyState | null {
  if (overview.totalSubmissions > 0 || overview.attemptedProblems > 0) {
    return null
  }

  return {
    isEmpty: true,
    title: "最近 7 天还没有学习数据",
    description: "去训练路径或题库完成几次提交后，这里会自动聚合活跃趋势、标签分布和下一步建议。",
  }
}

async function loadLearningWindowData(viewer: AccessViewer): Promise<LearningWindowData> {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const window = getWindowRange()
  const startAt = new Date(window.startAt)

  const [submissions, trainingPathList] = await Promise.all([
    db.submission.findMany({
      where: {
        userId: viewer.id,
        createdAt: { gte: startAt },
      },
      orderBy: { createdAt: "desc" },
      select: {
        problemId: true,
        createdAt: true,
        status: true,
      },
    }),
    listTrainingPaths({}, viewer),
  ])

  const submissionProblemIds = new Set(submissions.map((row) => row.problemId))

  const progressRows = await db.userProblemProgress.findMany({
    where: {
      userId: viewer.id,
      OR: [
        { updatedAt: { gte: startAt } },
        { solvedAt: { gte: startAt } },
        ...(submissionProblemIds.size > 0
          ? [
              {
                problemId: {
                  in: [...submissionProblemIds],
                },
              },
            ]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      problemId: true,
      status: true,
      attempts: true,
      solvedAt: true,
      updatedAt: true,
    },
  })

  const progressMap = new Map(progressRows.map((row) => [row.problemId, row]))
  const attemptedProblemIds = new Set([...submissionProblemIds, ...progressRows.map((row) => row.problemId)])
  const solvedProblemIds = new Set(
    progressRows.filter((row) => isSolvedInWindow(row, startAt)).map((row) => row.problemId),
  )

  for (const submission of submissions) {
    if (!isAcceptedStatus(submission.status) || progressMap.has(submission.problemId)) continue
    solvedProblemIds.add(submission.problemId)
  }

  const relevantProblemIds = [...new Set([...attemptedProblemIds, ...solvedProblemIds])]
  const problemRows =
    relevantProblemIds.length > 0
      ? await db.problem.findMany({
          where: {
            id: {
              in: relevantProblemIds,
            },
          },
          select: {
            id: true,
            title: true,
            difficulty: true,
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
        })
      : []

  const overview = buildOverview({
    attemptedProblemIds,
    solvedProblemIds,
    submissions,
  })
  const solvedBreakdown = buildDifficultyBreakdown(problemRows, solvedProblemIds)
  const tagDistribution = buildTagStats({
    problemRows,
    attemptedProblemIds,
    solvedProblemIds,
  })
  const trainingPaths = buildPathItems(trainingPathList.items)
  const trend = buildTrend(submissions)
  const nextStepAdvice = buildNextStepAdvice({
    overview,
    breakdown: solvedBreakdown,
    tags: tagDistribution,
    paths: trainingPaths,
  })
  const emptyState = buildEmptyState(overview)

  return {
    window,
    overview,
    solvedBreakdown,
    tagDistribution,
    trend,
    trainingPaths,
    nextStepAdvice,
    emptyState,
  }
}

export async function getLearningWindowDataForUser(userId: string, roles: string[] = []) {
  return loadLearningWindowData({ id: userId, roles })
}

async function getEnhancedAccess(viewer: AccessViewer) {
  const evaluator = await createContentAccessEvaluator(viewer)
  return evaluator.canAccessLearningReport("enhanced")
}

export async function getLearningOverview(viewer: AccessViewer): Promise<LearningReportOverviewPayload> {
  const [data, enhancedAccess] = await Promise.all([loadLearningWindowData(viewer), getEnhancedAccess(viewer)])

  return {
    window: data.window,
    overview: data.overview,
    currentTrainingPaths: data.trainingPaths.slice(0, 3),
    nextStepAdvice: data.nextStepAdvice,
    emptyState: data.emptyState,
    enhancedAccess,
  }
}

export async function getLearningWeekly(viewer: AccessViewer): Promise<LearningReportWeeklyPayload> {
  const [data, enhancedAccess] = await Promise.all([loadLearningWindowData(viewer), getEnhancedAccess(viewer)])

  return {
    window: data.window,
    overview: data.overview,
    solvedBreakdown: data.solvedBreakdown,
    tagDistribution: data.tagDistribution.slice(0, 8),
    trainingPaths: data.trainingPaths,
    nextStepAdvice: data.nextStepAdvice,
    emptyState: data.emptyState,
    enhancedAccess,
  }
}

export async function getLearningTrends(viewer: AccessViewer): Promise<LearningReportTrendsPayload> {
  const [data, enhancedAccess] = await Promise.all([loadLearningWindowData(viewer), getEnhancedAccess(viewer)])

  return {
    window: data.window,
    trend: data.trend,
    emptyState: data.emptyState,
    enhancedAccess,
  }
}

export async function getLearningReport(scopeValue: string, viewer: AccessViewer) {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const scope = normalizeScope(scopeValue)
  const [data, enhancedAccess] = await Promise.all([loadLearningWindowData(viewer), getEnhancedAccess(viewer)])
  const preview: LearningReportPreview = {
    overview: data.overview,
    solvedBreakdown: data.solvedBreakdown,
    topTags: data.tagDistribution.slice(0, 4),
    pathHighlights: data.trainingPaths.slice(0, 3),
  }

  const report: LearningReportData | null =
    scope === "basic" || enhancedAccess.allowed
      ? {
          overview: data.overview,
          solvedBreakdown: data.solvedBreakdown,
          topTags: data.tagDistribution.slice(0, scope === "basic" ? 6 : 10),
          trend: data.trend,
          trainingPaths: data.trainingPaths,
          focusAdvice: data.nextStepAdvice,
        }
      : null

  return {
    scope,
    locked: scope === "enhanced" ? !enhancedAccess.allowed : false,
    access:
      scope === "enhanced"
        ? enhancedAccess
        : {
            ...enhancedAccess,
            resourceId: "basic",
            allowed: true,
            grantedBy: "FREE" as const,
            reasonCode: "ALLOWED_FREE" as const,
            message: "基础学习报告对所有登录用户开放",
            policy: {
              requiredSources: ["FREE"],
              targets: [{ type: "learning_report" as const, id: "basic" }],
            },
            recommendedProducts: enhancedAccess.recommendedProducts,
          },
    preview,
    report,
  }
}
