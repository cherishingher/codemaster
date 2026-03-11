import { db } from "@/lib/db"
import { UserProblemStatus } from "@/lib/oj"
import type {
  LearningAnalyticsRiskLevel,
  PersonalizedLearningAnalyticsPayload,
  PersonalizedLearningBottleneck,
  PlatformBottleneckDistribution,
  PlatformLearningKpis,
  PlatformLearningOverviewPayload,
  PlatformLearningTagInsight,
  PlatformLearningTrendPoint,
  PlatformLearningTrendsPayload,
} from "@/lib/learning-analytics"
import { buildTrainingPathSlug, listTrainingPathDefinitions } from "@/lib/training-paths"
import { getLearningWindowDataForUser } from "@/server/modules/learning-report-center/service"

type Viewer = {
  id?: string | null
  roles?: string[]
}

type PlatformUserSubmissionMetric = {
  userId: string
  submissions: number
  activeDays: number
}

type PlatformUserProgressMetric = {
  userId: string
  attemptedProblems: number
  solvedProblems: number
}

type PlatformTagAggregate = {
  tag: string
  engagedUsers: number
  attemptedProblems: number
  solvedProblems: number
}

type PlatformTrendAggregate = {
  date: string
  submissions: number
  accepted: number
  activeUsers: number
}

type PlatformUserTagActivity = {
  userId: string
  tagId: string
  solved: boolean
}

function getWindow(days: number) {
  const endAt = new Date()
  const startAt = new Date(endAt)
  startAt.setHours(0, 0, 0, 0)
  startAt.setDate(startAt.getDate() - (days - 1))

  return {
    days,
    startAt,
    endAt,
    payload: {
      days,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    },
  }
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

function classifyRisk(metrics: {
  activeDays: number
  submissions: number
  attemptedProblems: number
  solvedProblems: number
}): { level: LearningAnalyticsRiskLevel; score: number } {
  let score = 0

  if (metrics.activeDays <= 1) score += 3
  else if (metrics.activeDays <= 3) score += 1

  const solveRate =
    metrics.attemptedProblems > 0 ? metrics.solvedProblems / metrics.attemptedProblems : 0
  if (metrics.attemptedProblems >= 3 && solveRate < 0.3) score += 3
  else if (metrics.attemptedProblems >= 2 && solveRate < 0.5) score += 2

  if (metrics.submissions >= 8 && metrics.solvedProblems === 0) score += 2
  if (metrics.submissions === 0) score += 1

  if (score >= 5) return { level: "high", score }
  if (score >= 3) return { level: "medium", score }
  return { level: "low", score }
}

function buildTrendSignal(points: Array<{ submissions: number; accepted: number; date: string }>) {
  const left = points.slice(0, Math.ceil(points.length / 2))
  const right = points.slice(-Math.ceil(points.length / 2))

  const previousAverageSubmissions = average(left.map((item) => item.submissions))
  const recentAverageSubmissions = average(right.map((item) => item.submissions))
  const previousAcceptedRate = average(
    left.map((item) => (item.submissions > 0 ? item.accepted / item.submissions : 0)),
  )
  const recentAcceptedRate = average(
    right.map((item) => (item.submissions > 0 ? item.accepted / item.submissions : 0)),
  )

  const submissionDelta = recentAverageSubmissions - previousAverageSubmissions
  const rateDelta = recentAcceptedRate - previousAcceptedRate

  let direction: "up" | "down" | "flat" = "flat"
  if (submissionDelta > 0.6 || rateDelta > 0.08) direction = "up"
  else if (submissionDelta < -0.6 || rateDelta < -0.08) direction = "down"

  const summary =
    direction === "up"
      ? "最近一段时间提交密度和通过质量都在改善，说明学习节奏正在回升。"
      : direction === "down"
        ? "最近一段时间活跃度或通过质量在下降，容易进入学习停滞区。"
        : "最近一段时间整体训练节奏比较平稳，适合做针对性突破。"

  return {
    direction,
    summary,
    previousAverageSubmissions,
    recentAverageSubmissions,
    previousAcceptedRate,
    recentAcceptedRate,
  }
}

function buildPersonalizedBottlenecks(args: Awaited<ReturnType<typeof getLearningWindowDataForUser>>) {
  const items: PersonalizedLearningBottleneck[] = []
  const { overview, tagDistribution, trainingPaths } = args

  if (overview.activeDays <= 2) {
    items.push({
      key: "consistency",
      title: "训练连续性不足",
      severity: overview.activeDays === 0 ? "high" : "medium",
      description: `最近 ${args.window.days} 天仅活跃 ${overview.activeDays} 天，节奏容易中断。`,
    })
  }

  if (overview.attemptedProblems >= 3 && overview.acceptedRate < 0.45) {
    items.push({
      key: "accuracy",
      title: "通过率偏低",
      severity: overview.acceptedRate < 0.3 ? "high" : "medium",
      description: `最近窗口通过率仅 ${Math.round(overview.acceptedRate * 100)}%，需要优先回看思路和边界条件。`,
    })
  }

  const weakTag = tagDistribution
    .filter((item) => item.attemptedProblems >= 2)
    .sort((a, b) => a.completionRate - b.completionRate)[0]
  if (weakTag && weakTag.completionRate < 0.5) {
    items.push({
      key: `tag:${weakTag.tag}`,
      title: `标签「${weakTag.tag}」薄弱`,
      severity: weakTag.completionRate < 0.3 ? "high" : "medium",
      description: `最近围绕该标签尝试 ${weakTag.attemptedProblems} 题，仅通过 ${weakTag.solvedProblems} 题。`,
    })
  }

  const stalledPath = trainingPaths.find(
    (item) =>
      !item.locked &&
      item.completionRate > 0 &&
      item.completionRate < 1 &&
      !item.lastLearningPositionTitle,
  )
  if (stalledPath) {
    items.push({
      key: `path:${stalledPath.id}`,
      title: "训练路径推进停滞",
      severity: "medium",
      description: `「${stalledPath.title}」已经开始但最近缺少推进，建议恢复连续训练。`,
    })
  }

  return items.slice(0, 4)
}

function buildStrengths(args: Awaited<ReturnType<typeof getLearningWindowDataForUser>>) {
  const strengths: string[] = []

  if (args.overview.currentStreak >= 3) {
    strengths.push(`已经连续训练 ${args.overview.currentStreak} 天，学习惯性较稳定。`)
  }

  if (args.overview.acceptedRate >= 0.6 && args.overview.attemptedProblems >= 3) {
    strengths.push(`最近窗口通过率达到 ${Math.round(args.overview.acceptedRate * 100)}%，解题质量较好。`)
  }

  const goodTags = args.tagDistribution
    .filter((item) => item.attemptedProblems >= 2 && item.completionRate >= 0.65)
    .slice(0, 2)
  for (const item of goodTags) {
    strengths.push(`标签「${item.tag}」掌握较稳，最近通过率 ${Math.round(item.completionRate * 100)}%。`)
  }

  const activePath = args.trainingPaths.find((item) => !item.locked && item.completionRate >= 0.4)
  if (activePath) {
    strengths.push(`训练路径「${activePath.title}」推进顺畅，当前完成度 ${Math.round(activePath.completionRate * 100)}%。`)
  }

  return strengths.slice(0, 4)
}

function buildActionableSuggestions(
  data: Awaited<ReturnType<typeof getLearningWindowDataForUser>>,
  bottlenecks: PersonalizedLearningBottleneck[],
) {
  const suggestions = [...data.nextStepAdvice]

  for (const item of bottlenecks) {
    if (item.key === "consistency") {
      suggestions.unshift("先固定每周至少 3 天、每次 30-45 分钟的训练时段，把节奏拉回来。")
    } else if (item.key === "accuracy") {
      suggestions.unshift("先用题解或视频复盘最近做错的题，再选同标签 2 题做针对性复练。")
    }
  }

  return [...new Set(suggestions)].slice(0, 5)
}

export async function getPersonalizedLearningAnalytics(
  viewer: Viewer,
): Promise<PersonalizedLearningAnalyticsPayload> {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const data = await getLearningWindowDataForUser(viewer.id, viewer.roles ?? [])
  const trendSignal = buildTrendSignal(data.trend)
  const bottlenecks = buildPersonalizedBottlenecks(data)
  const prediction = classifyRisk({
    activeDays: data.overview.activeDays,
    submissions: data.overview.totalSubmissions,
    attemptedProblems: data.overview.attemptedProblems,
    solvedProblems: data.overview.solvedProblems,
  })

  const predictionSummary =
    prediction.level === "high"
      ? "最近的训练节奏和通过质量都提示存在明显卡点，需要先做修复型训练。"
      : prediction.level === "medium"
        ? "当前存在局部瓶颈，适合做标签补强和路径复盘。"
        : "当前学习状态总体稳定，可以继续往更高难度推进。"

  return {
    window: data.window,
    overview: data.overview,
    trendSignal,
    strengths: buildStrengths(data),
    weakTags: data.tagDistribution
      .filter((item) => item.attemptedProblems > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 4),
    focusPaths: data.trainingPaths.slice(0, 3),
    bottlenecks,
    prediction: {
      level: prediction.level,
      score: prediction.score,
      summary: predictionSummary,
    },
    actionableSuggestions: buildActionableSuggestions(data, bottlenecks),
  }
}

async function loadPlatformUserMetrics(startAt: Date) {
  const [submissionMetrics, progressMetrics] = await Promise.all([
    db.$queryRaw<PlatformUserSubmissionMetric[]>`
      SELECT
        s."userId" AS "userId",
        COUNT(*)::int AS "submissions",
        COUNT(DISTINCT DATE_TRUNC('day', s."createdAt"))::int AS "activeDays"
      FROM "Submission" s
      WHERE s."createdAt" >= ${startAt}
      GROUP BY s."userId"
    `,
    db.$queryRaw<PlatformUserProgressMetric[]>`
      SELECT
        upp."userId" AS "userId",
        COUNT(*)::int AS "attemptedProblems",
        SUM(CASE WHEN upp."status" >= ${UserProblemStatus.ACCEPTED} OR upp."solvedAt" IS NOT NULL THEN 1 ELSE 0 END)::int AS "solvedProblems"
      FROM "UserProblemProgress" upp
      WHERE upp."updatedAt" >= ${startAt} OR upp."solvedAt" >= ${startAt}
      GROUP BY upp."userId"
    `,
  ])

  return { submissionMetrics, progressMetrics }
}

async function loadPlatformTagInsights(startAt: Date): Promise<PlatformLearningTagInsight[]> {
  const rows = await db.$queryRaw<PlatformTagAggregate[]>`
    SELECT
      t."name" AS "tag",
      COUNT(DISTINCT upp."userId")::int AS "engagedUsers",
      COUNT(*)::int AS "attemptedProblems",
      SUM(CASE WHEN upp."status" >= ${UserProblemStatus.ACCEPTED} OR upp."solvedAt" IS NOT NULL THEN 1 ELSE 0 END)::int AS "solvedProblems"
    FROM "UserProblemProgress" upp
    JOIN "ProblemTag" pt ON pt."problemId" = upp."problemId"
    JOIN "Tag" t ON t."id" = pt."tagId"
    WHERE upp."updatedAt" >= ${startAt} OR upp."solvedAt" >= ${startAt}
    GROUP BY t."name"
    ORDER BY "attemptedProblems" DESC, "solvedProblems" DESC
    LIMIT 10
  `

  return rows.map((row) => ({
    tag: row.tag,
    engagedUsers: row.engagedUsers,
    attemptedProblems: row.attemptedProblems,
    solvedProblems: row.solvedProblems,
    completionRate: row.attemptedProblems > 0 ? Number((row.solvedProblems / row.attemptedProblems).toFixed(4)) : 0,
  }))
}

async function loadPlatformPathAdoption(startAt: Date, activeUserCount: number) {
  const definitions = listTrainingPathDefinitions()
  const rawNames = [
    ...new Set(
      definitions.flatMap((definition) =>
        definition.chapters.flatMap((chapter) => [...(chapter.tagAliases ?? []), ...(chapter.fallbackTags ?? [])]),
      ),
    ),
  ]

  if (rawNames.length === 0) {
    return []
  }

  const tags = await db.tag.findMany({
    where: {
      OR: rawNames.map((name) => ({
        name: {
          equals: name,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
      name: true,
    },
  })

  const tagIdMap = new Map(tags.map((item) => [item.name.trim().toLowerCase(), item.id]))

  const activityRows = await db.$queryRaw<PlatformUserTagActivity[]>`
    SELECT
      upp."userId" AS "userId",
      pt."tagId" AS "tagId",
      MAX(CASE WHEN upp."status" >= ${UserProblemStatus.ACCEPTED} OR upp."solvedAt" IS NOT NULL THEN 1 ELSE 0 END) = 1 AS "solved"
    FROM "UserProblemProgress" upp
    JOIN "ProblemTag" pt ON pt."problemId" = upp."problemId"
    WHERE upp."updatedAt" >= ${startAt} OR upp."solvedAt" >= ${startAt}
    GROUP BY upp."userId", pt."tagId"
  `

  return definitions.map((definition) => {
    const pathTagIds = new Set(
      definition.chapters.flatMap((chapter) =>
        [...(chapter.tagAliases ?? []), ...(chapter.fallbackTags ?? [])]
          .map((name) => tagIdMap.get(name.trim().toLowerCase()) ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    const engagedUsers = new Set<string>()
    const solvedUsers = new Set<string>()

    for (const row of activityRows) {
      if (!pathTagIds.has(row.tagId)) continue
      engagedUsers.add(row.userId)
      if (row.solved) solvedUsers.add(row.userId)
    }

    return {
      id: definition.id,
      slug: buildTrainingPathSlug(definition.id, definition.title),
      title: definition.title,
      level: definition.level,
      engagedUsers: engagedUsers.size,
      solvedUsers: solvedUsers.size,
      engagementRate: activeUserCount > 0 ? Number((engagedUsers.size / activeUserCount).toFixed(4)) : 0,
      solveRate: engagedUsers.size > 0 ? Number((solvedUsers.size / engagedUsers.size).toFixed(4)) : 0,
    }
  })
}

async function loadPlatformKpis(startAt: Date): Promise<PlatformLearningKpis> {
  const [{ submissionMetrics, progressMetrics }, totalUsers, totalSubmissions, acceptedSubmissions, campParticipants, contestParticipants] =
    await Promise.all([
      loadPlatformUserMetrics(startAt),
      db.user.count(),
      db.submission.count({
        where: {
          createdAt: { gte: startAt },
        },
      }),
      db.submission.count({
        where: {
          createdAt: { gte: startAt },
          status: { in: ["AC", "ACCEPTED", "PARTIAL"] },
        },
      }),
      db.campEnrollment.count({
        where: {
          enrolledAt: { gte: startAt },
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
      }),
      db.contestRegistration.count({
        where: {
          joinedAt: { gte: startAt },
          status: "JOINED",
        },
      }),
    ])

  const submissionMap = new Map(submissionMetrics.map((item) => [item.userId, item]))
  const progressMap = new Map(progressMetrics.map((item) => [item.userId, item]))
  const activeUserIds = new Set([...submissionMap.keys(), ...progressMap.keys()])

  const solvedUsers = [...progressMap.values()].filter((item) => item.solvedProblems > 0).length

  return {
    totalUsers,
    activeUsers: activeUserIds.size,
    solvedUsers,
    totalSubmissions,
    acceptedSubmissions,
    acceptedRate: totalSubmissions > 0 ? Number((acceptedSubmissions / totalSubmissions).toFixed(4)) : 0,
    avgActiveDays: average(submissionMetrics.map((item) => item.activeDays)),
    avgSolvedProblems: average(progressMetrics.map((item) => item.solvedProblems)),
    campParticipants,
    contestParticipants,
  }
}

async function loadPlatformRiskDistribution(startAt: Date): Promise<PlatformBottleneckDistribution> {
  const { submissionMetrics, progressMetrics } = await loadPlatformUserMetrics(startAt)
  const progressMap = new Map(progressMetrics.map((item) => [item.userId, item]))

  const distribution: PlatformBottleneckDistribution = {
    low: 0,
    medium: 0,
    high: 0,
  }

  for (const item of submissionMetrics) {
    const progress = progressMap.get(item.userId)
    const risk = classifyRisk({
      activeDays: item.activeDays,
      submissions: item.submissions,
      attemptedProblems: progress?.attemptedProblems ?? 0,
      solvedProblems: progress?.solvedProblems ?? 0,
    })
    distribution[risk.level] += 1
  }

  return distribution
}

async function loadPlatformTrend(days = 14): Promise<{ window: PlatformLearningTrendsPayload["window"]; trend: PlatformLearningTrendPoint[] }> {
  const { startAt, payload } = getWindow(days)
  const rows = await db.$queryRaw<PlatformTrendAggregate[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', s."createdAt"), 'YYYY-MM-DD') AS "date",
      COUNT(*)::int AS "submissions",
      SUM(CASE WHEN s."status" IN ('AC', 'ACCEPTED', 'PARTIAL') THEN 1 ELSE 0 END)::int AS "accepted",
      COUNT(DISTINCT s."userId")::int AS "activeUsers"
    FROM "Submission" s
    WHERE s."createdAt" >= ${startAt}
    GROUP BY DATE_TRUNC('day', s."createdAt")
    ORDER BY DATE_TRUNC('day', s."createdAt") ASC
  `

  const bucketMap = new Map(rows.map((row) => [row.date, row]))
  const trend: PlatformLearningTrendPoint[] = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    const key = formatLocalDateKey(date)
    const row = bucketMap.get(key)
    trend.push({
      date: key,
      submissions: row?.submissions ?? 0,
      accepted: row?.accepted ?? 0,
      activeUsers: row?.activeUsers ?? 0,
    })
  }

  return {
    window: payload,
    trend,
  }
}

export async function getPlatformLearningAnalyticsOverview(): Promise<PlatformLearningOverviewPayload> {
  const { startAt, payload } = getWindow(30)
  const [kpis, topTags, bottleneckDistribution] = await Promise.all([
    loadPlatformKpis(startAt),
    loadPlatformTagInsights(startAt),
    loadPlatformRiskDistribution(startAt),
  ])

  const pathAdoption = await loadPlatformPathAdoption(startAt, kpis.activeUsers)

  const recommendations: string[] = []

  if (bottleneckDistribution.high >= Math.max(5, Math.round(kpis.activeUsers * 0.25))) {
    recommendations.push("高风险学习用户占比偏高，建议重点投放复盘型内容和低门槛训练路径。")
  }

  const weakestHotTag = [...topTags].sort((a, b) => a.completionRate - b.completionRate)[0]
  if (weakestHotTag && weakestHotTag.completionRate < 0.45) {
    recommendations.push(`热门标签「${weakestHotTag.tag}」完成率偏低，适合补更多题解、视频和专题训练。`)
  }

  const weakAdvancedPath = pathAdoption
    .filter((item) => item.level !== "beginner")
    .sort((a, b) => a.solveRate - b.solveRate)[0]
  if (weakAdvancedPath && weakAdvancedPath.engagedUsers > 0) {
    recommendations.push(`进阶路径「${weakAdvancedPath.title}」转化偏弱，建议拆分章节并补桥接内容。`)
  }

  if (kpis.campParticipants > 0 && kpis.contestParticipants === 0) {
    recommendations.push("训练营参与已经形成，但模拟赛参与偏弱，可以加赛前诊断和赛后解析导流。")
  }

  if (recommendations.length === 0) {
    recommendations.push("当前平台学习趋势整体稳定，下一步可针对进阶路径和热点标签继续优化供给。")
  }

  return {
    window: payload,
    kpis,
    topTags,
    pathAdoption,
    bottleneckDistribution,
    recommendations: recommendations.slice(0, 4),
  }
}

export async function getPlatformLearningAnalyticsTrends(): Promise<PlatformLearningTrendsPayload> {
  const { window, trend } = await loadPlatformTrend(14)
  const submissionSignal = buildTrendSignal(trend)
  const peak = [...trend].sort((a, b) => b.submissions - a.submissions)[0]
  const low = [...trend].sort((a, b) => a.submissions - b.submissions)[0]

  return {
    window,
    trend,
    signal: {
      direction: submissionSignal.direction,
      summary:
        submissionSignal.direction === "up"
          ? "近 14 天平台整体学习活跃度正在上升，适合同步放量训练营和进阶内容。"
          : submissionSignal.direction === "down"
            ? "近 14 天平台整体学习活跃度有回落，建议加强召回、复盘和轻量任务运营。"
            : "近 14 天平台整体趋势较平稳，适合针对低完成率专题做结构优化。",
      peakDate: peak?.date ?? null,
      lowestDate: low?.date ?? null,
    },
  }
}
