import { db } from "@/lib/db"
import {
  AI_PLAN_DEFAULT_DAYS,
  AI_RECOMMENDATION_WINDOW_DAYS,
  type AiLearningPlanPayload,
  type AiPlanDay,
  type AiPlanTask,
  type AiRecommendationItem,
  type AiRecommendationsPayload,
  type AiTagSignal,
  type AiTutorPayload,
  type AiUserProfileSummary,
} from "@/lib/ai"
import { UserProblemStatus } from "@/lib/oj"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import { listTrainingPaths } from "@/server/modules/training-path-center/service"
import type { AiLearningPlanInput, AiRecommendationsQuery, AiTutorInput } from "@/server/modules/ai-center/schemas"

type AiViewer = {
  id: string
  roles?: string[]
}

type ProgressRow = {
  problemId: string
  status: number
  attempts: number
  solvedAt: Date | null
  updatedAt: Date
  problem: {
    id: string
    slug: string
    title: string
    difficulty: number
    source: string | null
    tags: Array<{ tag: { name: string } }>
  }
}

type SubmissionRow = {
  problemId: string
  createdAt: Date
  status: string
  problem: {
    id: string
    slug: string
    title: string
    tags: Array<{ tag: { name: string } }>
  }
}

type LessonRow = {
  id: string
  slug: string
  title: string
  summary: string | null
  isPreview: boolean
  section: {
    courseId: string
    course: {
      title: string
    }
  }
}

type SolutionRow = {
  id: string
  title: string
  summary: string | null
  content: string
  problemId: string
  visibility: string
  accessLevel: string | null
  isPremium: boolean
  problem: {
    slug: string
    title: string
    difficulty: number
    tags: Array<{ tag: { name: string } }>
  }
}

type ProblemContext = {
  id: string
  title: string
  slug: string
  difficulty: number
  source: string | null
  tags: string[]
  statement: string | null
  hints: string | null
  solutionSummary: string | null
}

type LearningSignals = {
  profile: AiUserProfileSummary
  weakTags: AiTagSignal[]
  strongTags: AiTagSignal[]
  recentProgressRows: ProgressRow[]
  recentSubmissions: SubmissionRow[]
  trainingPaths: Awaited<ReturnType<typeof listTrainingPaths>>["items"]
}

function acceptedStatus(status: string) {
  const normalized = status.toUpperCase()
  return normalized === "AC" || normalized === "ACCEPTED" || normalized === "PARTIAL"
}

function buildDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWindowStart(days = AI_RECOMMENDATION_WINDOW_DAYS) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return start
}

function previewText(value: string | null | undefined, limit = 180) {
  const text = (value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return ""
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter(Boolean) as string[])]
}

function normalizeGoal(goal?: string | null) {
  return goal?.trim() || "提升最近一周的训练效率并继续当前路径"
}

function extractGoalKeywords(goal: string, candidateTags: string[]) {
  const normalized = goal.trim()
  if (!normalized) return []

  const matchedTags = candidateTags.filter((tag) => normalized.includes(tag))
  const roughTokens = normalized
    .split(/[\s,，。；;、/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)

  return uniqueStrings([...matchedTags, ...roughTokens]).slice(0, 8)
}

function buildTagSignals(progressRows: ProgressRow[], submissions: SubmissionRow[]) {
  const counter = new Map<
    string,
    {
      attemptedProblems: number
      solvedProblems: number
      wrongSubmissions: number
    }
  >()

  for (const row of progressRows) {
    const solved = row.status >= UserProblemStatus.ACCEPTED || Boolean(row.solvedAt)
    const tags = row.problem.tags.map((item) => item.tag.name)

    for (const tag of tags) {
      const current = counter.get(tag) ?? {
        attemptedProblems: 0,
        solvedProblems: 0,
        wrongSubmissions: 0,
      }
      current.attemptedProblems += 1
      if (solved) current.solvedProblems += 1
      counter.set(tag, current)
    }
  }

  for (const row of submissions) {
    if (acceptedStatus(row.status)) continue
    for (const tag of row.problem.tags.map((item) => item.tag.name)) {
      const current = counter.get(tag) ?? {
        attemptedProblems: 0,
        solvedProblems: 0,
        wrongSubmissions: 0,
      }
      current.wrongSubmissions += 1
      counter.set(tag, current)
    }
  }

  const values = [...counter.entries()].map(([tag, value]) => ({
    tag,
    attemptedProblems: value.attemptedProblems,
    solvedProblems: value.solvedProblems,
    wrongSubmissions: value.wrongSubmissions,
    completionRate:
      value.attemptedProblems > 0
        ? Number((value.solvedProblems / value.attemptedProblems).toFixed(4))
        : 0,
    score:
      (1 - (value.attemptedProblems > 0 ? value.solvedProblems / value.attemptedProblems : 0)) *
        Math.max(1, value.attemptedProblems) +
      value.wrongSubmissions * 0.7,
  }))

  const weakTags = values
    .filter(
      (item) =>
        item.attemptedProblems >= 2 &&
        (item.completionRate < 0.6 || item.wrongSubmissions >= 2),
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.tag.localeCompare(b.tag, "zh-CN")
    })
    .slice(0, 4)
    .map(({ score: _score, ...rest }) => rest)

  const strongTags = values
    .filter((item) => item.attemptedProblems >= 2 && item.completionRate >= 0.75)
    .sort((a, b) => {
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate
      if (b.attemptedProblems !== a.attemptedProblems) return b.attemptedProblems - a.attemptedProblems
      return a.tag.localeCompare(b.tag, "zh-CN")
    })
    .slice(0, 4)
    .map(({ score: _score, ...rest }) => rest)

  const interests = values
    .sort((a, b) => {
      if (b.attemptedProblems !== a.attemptedProblems) return b.attemptedProblems - a.attemptedProblems
      return a.tag.localeCompare(b.tag, "zh-CN")
    })
    .map((item) => item.tag)
    .filter((tag) => !weakTags.some((item) => item.tag === tag))
    .slice(0, 4)

  return {
    weakTags,
    strongTags,
    interests,
  }
}

async function loadLearningSignals(viewer: AiViewer): Promise<LearningSignals> {
  const windowStart = getWindowStart()

  const [progressRows, submissions, trainingPaths] = await Promise.all([
    db.userProblemProgress.findMany({
      where: {
        userId: viewer.id,
        attempts: { gt: 0 },
      },
      orderBy: { updatedAt: "desc" },
      take: 240,
      select: {
        problemId: true,
        status: true,
        attempts: true,
        solvedAt: true,
        updatedAt: true,
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            source: true,
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
    }),
    db.submission.findMany({
      where: {
        userId: viewer.id,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        problemId: true,
        createdAt: true,
        status: true,
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
    }),
    listTrainingPaths({ q: "" }, viewer),
  ])

  const recentProgressRows = progressRows.filter(
    (row) => row.updatedAt >= windowStart || (row.solvedAt ? row.solvedAt >= windowStart : false),
  )
  const consideredProgressRows = recentProgressRows.length > 0 ? recentProgressRows : progressRows.slice(0, 80)

  const solvedRows = consideredProgressRows.filter(
    (row) => row.status >= UserProblemStatus.ACCEPTED || Boolean(row.solvedAt),
  )
  const activeDays = new Set(submissions.map((item) => buildDateKey(item.createdAt))).size
  const attemptedProblems = new Set(consideredProgressRows.map((item) => item.problemId)).size
  const solvedProblems = new Set(solvedRows.map((item) => item.problemId)).size
  const acceptedRate =
    attemptedProblems > 0 ? Number((solvedProblems / attemptedProblems).toFixed(4)) : 0

  const tagSignals = buildTagSignals(consideredProgressRows, submissions)
  const activePathTitles = trainingPaths.items
    .filter(
      (item) =>
        !item.locked &&
        Boolean(
          item.progress &&
            (item.progress.completedProblems > 0 || item.progress.lastLearningPosition),
        ),
    )
    .map((item) => item.title)

  return {
    profile: {
      activeDays,
      attemptedProblems,
      solvedProblems,
      acceptedRate,
      weakTags: tagSignals.weakTags,
      strongTags: tagSignals.strongTags,
      interests: tagSignals.interests,
      activePathTitles,
    },
    weakTags: tagSignals.weakTags,
    strongTags: tagSignals.strongTags,
    recentProgressRows: consideredProgressRows,
    recentSubmissions: submissions,
    trainingPaths: trainingPaths.items,
  }
}

function buildPathRecommendations(
  signals: LearningSignals,
  goalKeywords: string[],
): AiRecommendationItem[] {
  const weakTags = signals.weakTags.map((item) => item.tag)

  return signals.trainingPaths
    .map((path) => {
      const tagOverlap = path.topTags.filter((tag) => weakTags.includes(tag))
      const keywordHits = goalKeywords.filter(
        (keyword) =>
          path.title.includes(keyword) ||
          path.summary.includes(keyword) ||
          path.topTags.some((tag) => tag.includes(keyword) || keyword.includes(tag)),
      ).length
      const isInProgress = Boolean(
        path.progress && path.progress.completionRate > 0 && path.progress.completionRate < 1,
      )

      const score =
        tagOverlap.length * 30 +
        keywordHits * 28 +
        (isInProgress ? 48 : 0) +
        (!path.locked ? 18 : 4) +
        Math.max(0, 10 - path.chapterCount)

      const reason = isInProgress
        ? `继续推进「${path.title}」，当前完成度 ${Math.round((path.progress?.completionRate ?? 0) * 100)}%。`
        : tagOverlap.length > 0
          ? `这条路径覆盖 ${tagOverlap.join(" / ")}，和你最近需要补强的标签高度相关。`
          : `这条路径和你的近期目标更贴近，适合用来建立稳定的训练节奏。`
      const source: AiRecommendationItem["source"] = isInProgress
        ? "active_path"
        : tagOverlap.length > 0
          ? "weak_tag"
          : "goal"

      return {
        score,
        item: {
          id: path.id,
          resourceType: "training_path" as const,
          title: path.title,
          summary: path.summary,
          href: `/training-paths/${path.slug}`,
          reason,
          source,
          tags: path.topTags.slice(0, 4),
          difficulty: path.difficultySummary.average ?? null,
          locked: path.locked,
          requiredSources: path.access.policy.requiredSources,
        },
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))
    .slice(0, 2)
    .map((item) => item.item)
}

function buildProblemRecommendations(
  signals: LearningSignals,
  goalKeywords: string[],
): AiRecommendationItem[] {
  const weakTags = signals.weakTags.map((item) => item.tag)

  return signals.recentProgressRows
    .filter((row) => row.status < UserProblemStatus.ACCEPTED && row.attempts > 0)
    .map((row) => {
      const tags = row.problem.tags.map((item) => item.tag.name)
      const tagOverlap = tags.filter((tag) => weakTags.includes(tag))
      const keywordHits = goalKeywords.filter(
        (keyword) =>
          row.problem.title.includes(keyword) ||
          tags.some((tag) => tag.includes(keyword) || keyword.includes(tag)),
      ).length
      const score = row.attempts * 20 + tagOverlap.length * 22 + keywordHits * 18
      const reason =
        tagOverlap.length > 0
          ? `这道题和 ${tagOverlap.join(" / ")} 相关，且你已经有 ${row.attempts} 次尝试，适合优先回做。`
          : `这道题你已经尝试过 ${row.attempts} 次，优先复盘比刷新题更容易提分。`
      const source: AiRecommendationItem["source"] =
        tagOverlap.length > 0 ? "wrong_answer" : "interest"

      return {
        score,
        item: {
          id: row.problem.id,
          resourceType: "problem" as const,
          title: row.problem.title,
          summary: `难度 ${row.problem.difficulty} · ${row.problem.source ?? "题库题"} · 继续围绕已尝试问题做针对性复盘。`,
          href: `/problems/${row.problem.slug}`,
          reason,
          source,
          tags,
          difficulty: row.problem.difficulty,
          locked: false,
          requiredSources: [],
        },
      }
    })
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))
    .slice(0, 2)
    .map((item) => item.item)
}

async function buildSolutionRecommendations(
  signals: LearningSignals,
  viewer: AiViewer,
  goalKeywords: string[],
): Promise<AiRecommendationItem[]> {
  const evaluator = await createContentAccessEvaluator(viewer)
  const candidateProblemIds = signals.recentProgressRows
    .filter((row) => row.status < UserProblemStatus.ACCEPTED && row.attempts > 0)
    .map((row) => row.problemId)
    .slice(0, 8)

  if (candidateProblemIds.length === 0) return [] as AiRecommendationItem[]

  const rows = await db.solution.findMany({
    where: {
      problemId: { in: candidateProblemIds },
      status: "published",
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      content: true,
      problemId: true,
      visibility: true,
      accessLevel: true,
      isPremium: true,
      problem: {
        select: {
          slug: true,
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
      },
    },
  })

  const seenProblemIds = new Set<string>()
  const items: Array<{ score: number; item: AiRecommendationItem }> = []

  for (const row of rows) {
    if (seenProblemIds.has(row.problemId)) continue
    seenProblemIds.add(row.problemId)

    const tags = row.problem.tags.map((item) => item.tag.name)
    const tagOverlap = tags.filter((tag) => signals.weakTags.some((item) => item.tag === tag))
    const keywordHits = goalKeywords.filter(
      (keyword) =>
        row.problem.title.includes(keyword) ||
        tags.some((tag) => tag.includes(keyword) || keyword.includes(tag)),
    ).length
    const access = await evaluator.canAccessSolution({
      id: row.id,
      problemId: row.problemId,
      visibility: row.visibility,
      accessLevel: row.accessLevel,
      isPremium: row.isPremium,
    })

    items.push({
      score: tagOverlap.length * 26 + keywordHits * 18 + (access.allowed ? 12 : 4),
      item: {
        id: row.id,
        resourceType: "solution",
        title: row.title,
        summary: row.summary?.trim() || previewText(row.content, 120),
        href: `/problems/${row.problem.slug}#solutions`,
        reason: tagOverlap.length
          ? `这条题解覆盖 ${tagOverlap.join(" / ")} 相关问题，适合你在做题后马上复盘。`
          : "把题解加入训练节奏里，可以更快定位思路偏差和调试盲点。",
        source: tagOverlap.length > 0 ? "weak_tag" : "interest",
        tags,
        difficulty: row.problem.difficulty,
        locked: !access.allowed,
        requiredSources: access.policy.requiredSources,
      },
    })
  }

  return items
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))
    .slice(0, 2)
    .map((item) => item.item)
}

async function buildVideoRecommendations(
  signals: LearningSignals,
  viewer: AiViewer,
  goalKeywords: string[],
): Promise<AiRecommendationItem[]> {
  const focusKeywords = uniqueStrings([
    ...signals.weakTags.map((item) => item.tag),
    ...signals.profile.interests,
    ...goalKeywords,
  ]).slice(0, 6)

  if (focusKeywords.length === 0) return [] as AiRecommendationItem[]

  const evaluator = await createContentAccessEvaluator(viewer)
  const rows = await db.lesson.findMany({
    where: {
      status: "published",
      OR: focusKeywords.flatMap((keyword) => [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
      ]),
    },
    orderBy: [{ isPreview: "desc" }, { sortOrder: "asc" }],
    take: 6,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      isPreview: true,
      section: {
        select: {
          courseId: true,
          course: {
            select: {
              title: true,
            },
          },
        },
      },
    },
  })

  const items: Array<{ score: number; item: AiRecommendationItem }> = []

  for (const row of rows as LessonRow[]) {
    const keywordHits = focusKeywords.filter(
      (keyword) =>
        row.title.includes(keyword) || (row.summary ?? "").includes(keyword) || row.section.course.title.includes(keyword),
    )
    const access = await evaluator.canAccessVideo({
      id: row.id,
      courseId: row.section.courseId,
      isPreview: row.isPreview,
    })

    items.push({
      score: keywordHits.length * 24 + (row.isPreview ? 10 : 4),
      item: {
        id: row.id,
        resourceType: "video",
        title: row.title,
        summary: row.summary?.trim() || `来自课程「${row.section.course.title}」的视频内容。`,
        href: `/learn/${row.slug}`,
        reason: keywordHits.length > 0
          ? `这条视频和 ${keywordHits.join(" / ")} 更相关，适合作为本周的理解补强材料。`
          : "先用视频把关键概念串起来，再回到题库做题会更顺。",
        source: keywordHits.length > 0 ? "goal" : "interest",
        tags: keywordHits,
        difficulty: null,
        locked: !access.allowed,
        requiredSources: access.policy.requiredSources,
      },
    })
  }

  return items
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))
    .slice(0, 2)
    .map((item) => item.item)
}

function rankRecommendationList(items: AiRecommendationItem[], limit: number) {
  const priority: Record<AiRecommendationItem["resourceType"], number> = {
    training_path: 10,
    problem: 20,
    solution: 30,
    video: 40,
  }

  return items
    .sort((a, b) => {
      if (a.locked !== b.locked) return a.locked ? 1 : -1
      if (priority[a.resourceType] !== priority[b.resourceType]) {
        return priority[a.resourceType] - priority[b.resourceType]
      }
      return a.title.localeCompare(b.title, "zh-CN")
    })
    .slice(0, limit)
}

async function buildRecommendations(
  viewer: AiViewer,
  signals: LearningSignals,
  query?: Partial<AiRecommendationsQuery>,
): Promise<AiRecommendationItem[]> {
  const goal = normalizeGoal(query?.goal)
  const goalKeywords = extractGoalKeywords(
    goal,
    uniqueStrings([...signals.weakTags.map((item) => item.tag), ...signals.profile.interests]),
  )

  const [paths, problems, solutions, videos] = await Promise.all([
    Promise.resolve(buildPathRecommendations(signals, goalKeywords)),
    Promise.resolve(buildProblemRecommendations(signals, goalKeywords)),
    buildSolutionRecommendations(signals, viewer, goalKeywords),
    buildVideoRecommendations(signals, viewer, goalKeywords),
  ])

  return rankRecommendationList(
    uniqueById([...paths, ...problems, ...solutions, ...videos]),
    query?.limit ?? 6,
  )
}

function uniqueById(items: AiRecommendationItem[]) {
  const map = new Map<string, AiRecommendationItem>()
  for (const item of items) {
    map.set(`${item.resourceType}:${item.id}`, item)
  }
  return [...map.values()]
}

function pickFocusTags(signals: LearningSignals, goal: string, recommendations: AiRecommendationItem[]) {
  const goalKeywords = extractGoalKeywords(
    goal,
    uniqueStrings([
      ...signals.weakTags.map((item) => item.tag),
      ...signals.profile.interests,
      ...recommendations.flatMap((item) => item.tags),
    ]),
  )

  const matched = signals.weakTags
    .map((item) => item.tag)
    .filter((tag) => goalKeywords.some((keyword) => keyword.includes(tag) || tag.includes(keyword)))

  return uniqueStrings([
    ...matched,
    ...signals.weakTags.map((item) => item.tag),
    ...signals.profile.interests,
  ]).slice(0, 3)
}

function buildPlanSummary(goal: string, profile: AiUserProfileSummary, focusTags: string[]) {
  if (profile.activeDays === 0) {
    return `这是一份围绕「${goal}」的恢复型计划，先把做题节奏重新建立起来，再逐步补强 ${focusTags.join(" / ")}。`
  }

  if (profile.acceptedRate < 0.5) {
    return `这份计划优先处理错题复盘和标签补强，目标是在保持训练频次的同时，把近期通过率慢慢拉高。`
  }

  return `这份计划会围绕「${goal}」继续推进当前训练路径，并把 ${focusTags.join(" / ")} 作为最近一周的重点补强方向。`
}

function buildPlanAdjustments(profile: AiUserProfileSummary, focusTags: string[], recommendations: AiRecommendationItem[]) {
  const result: string[] = []

  if (profile.activeDays < 3) {
    result.push("先保证每周至少 3 天训练，稳定节奏比一次刷很多题更重要。")
  }
  if (focusTags.length > 0) {
    result.push(`优先围绕 ${focusTags.join(" / ")} 做集中训练，不要把注意力摊得过散。`)
  }
  if (recommendations.some((item) => item.resourceType === "solution")) {
    result.push("每次做完重点题后，安排 10-15 分钟看题解或视频解析，及时校正思路。")
  }
  if (result.length === 0) {
    result.push("保持当前训练路径推进，并在周末做一次集中复盘。")
  }

  return result.slice(0, 4)
}

function buildPlanDays(args: {
  goal: string
  days: number
  focusTags: string[]
  recommendations: AiRecommendationItem[]
}) {
  const accessibleResources = args.recommendations.filter((item) => !item.locked)
  const fallbackResources = accessibleResources.length > 0 ? accessibleResources : args.recommendations
  const primaryPath = fallbackResources.find((item) => item.resourceType === "training_path") ?? null
  const primaryProblem = fallbackResources.find((item) => item.resourceType === "problem") ?? null
  const primarySolution = fallbackResources.find((item) => item.resourceType === "solution") ?? null
  const primaryVideo = fallbackResources.find((item) => item.resourceType === "video") ?? null

  const days: AiPlanDay[] = []

  for (let index = 0; index < args.days; index += 1) {
    const focusTag = args.focusTags[index % Math.max(1, args.focusTags.length)] ?? "综合复盘"
    const tasks: AiPlanTask[] = [
      {
        id: `review-${index + 1}`,
        title: `复盘 ${focusTag}`,
        description: `先回顾最近在「${focusTag}」相关题上的易错点，写下 1-2 个导致失分的关键原因。`,
        estimatedMinutes: 15,
        resourceType: "review",
        href: primarySolution?.href ?? primaryProblem?.href ?? null,
        locked: false,
        requiredSources: [],
      },
    ]

    if (primaryPath) {
      tasks.push({
        id: `path-${index + 1}`,
        title: `推进训练路径：${primaryPath.title}`,
        description: `沿着训练路径继续做题，把今天的主训练时间放在当前章节推进上。`,
        estimatedMinutes: 30,
        resourceType: "training_path",
        href: primaryPath.href,
        locked: primaryPath.locked,
        requiredSources: primaryPath.requiredSources,
      })
    } else if (primaryProblem) {
      tasks.push({
        id: `problem-${index + 1}`,
        title: `专项做题：${primaryProblem.title}`,
        description: `围绕今天的重点标签完成一题专项训练，先独立思考，再提交验证。`,
        estimatedMinutes: 30,
        resourceType: "problem",
        href: primaryProblem.href,
        locked: false,
        requiredSources: [],
      })
    }

    if (index % 2 === 1 && primaryVideo) {
      tasks.push({
        id: `video-${index + 1}`,
        title: `视频补强：${primaryVideo.title}`,
        description: "用视频内容快速补齐知识点理解，再回到题库验证是否真正掌握。",
        estimatedMinutes: 20,
        resourceType: "video",
        href: primaryVideo.href,
        locked: primaryVideo.locked,
        requiredSources: primaryVideo.requiredSources,
      })
    } else if (primarySolution) {
      tasks.push({
        id: `solution-${index + 1}`,
        title: `题解复盘：${primarySolution.title}`,
        description: "对照题解检查自己的状态设计、边界处理和复杂度分析是否完整。",
        estimatedMinutes: 15,
        resourceType: "solution",
        href: primarySolution.href,
        locked: primarySolution.locked,
        requiredSources: primarySolution.requiredSources,
      })
    }

    tasks.push({
      id: `reflection-${index + 1}`,
      title: "训练总结",
      description: "记录今天最容易错的一步，以及明天继续训练前要先检查的点。",
      estimatedMinutes: 10,
      resourceType: "reflection",
      href: null,
      locked: false,
      requiredSources: [],
    })

    days.push({
      day: index + 1,
      focus: focusTag,
      estimatedMinutes: tasks.reduce((sum, item) => sum + item.estimatedMinutes, 0),
      tasks,
    })
  }

  return days
}

async function loadProblemContext(problemId: string, viewer: AiViewer): Promise<ProblemContext | null> {
  const evaluator = await createContentAccessEvaluator(viewer)

  const problem = await db.problem.findFirst({
    where: {
      OR: [{ id: problemId }, { slug: problemId }],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      difficulty: true,
      source: true,
      tags: {
        select: {
          tag: {
            select: {
              name: true,
            },
          },
        },
      },
      currentVersion: {
        select: {
          statement: true,
          statementMd: true,
          hints: true,
        },
      },
    },
  })

  if (!problem) return null

  const solution = await db.solution.findFirst({
    where: {
      problemId,
      status: "published",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      problemId: true,
      summary: true,
      content: true,
      visibility: true,
      accessLevel: true,
      isPremium: true,
    },
  })

  let solutionSummary: string | null = null
  if (solution) {
    const access = await evaluator.canAccessSolution({
      id: solution.id,
      problemId,
      visibility: solution.visibility,
      accessLevel: solution.accessLevel,
      isPremium: solution.isPremium,
    })
    solutionSummary = access.allowed
      ? solution.summary?.trim() || previewText(solution.content, 220)
      : solution.summary?.trim() || previewText(solution.content, 120)
  }

  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    source: problem.source,
    tags: problem.tags.map((item) => item.tag.name),
    statement: problem.currentVersion?.statementMd?.trim() || problem.currentVersion?.statement?.trim() || null,
    hints: problem.currentVersion?.hints?.trim() || null,
    solutionSummary,
  }
}

function buildHeuristicTutorAnswer(args: {
  question: string
  profile: AiUserProfileSummary
  focusTags: string[]
  problem: ProblemContext | null
}) {
  const sections: string[] = []

  if (args.problem) {
    sections.push(`### 这道题先怎么读\n- 题目：**${args.problem.title}**\n- 难度：${args.problem.difficulty}\n- 相关标签：${args.problem.tags.join(" / ") || "未标记"}\n- 先把输入、输出、状态定义和边界条件各写一句，再决定算法。`)

    if (args.problem.statement) {
      sections.push(`### 先抓题面关键信息\n${previewText(args.problem.statement, 240)}`)
    }

    sections.push(
      `### 建议你先这样拆解\n1. 先写出最直接的暴力或模拟思路，确认题意没有理解偏。\n2. 再根据标签判断是否需要 ${args.problem.tags.slice(0, 2).join(" / ") || "状态设计"}。\n3. 提交前重点检查边界、数组下标、初始化和循环终止条件。`,
    )

    if (args.problem.solutionSummary) {
      sections.push(`### 现有题解能给你的提示\n${args.problem.solutionSummary}`)
    }

    if (args.problem.hints) {
      sections.push(`### 题面自带提示\n${previewText(args.problem.hints, 180)}`)
    }
  } else {
    const focus = args.focusTags[0] ?? "当前训练重点"
    sections.push(
      `### 我建议你先从这个角度理解\n围绕 **${focus}**，先搞清楚“状态 / 搜索过程 / 转移关系”三者里哪一个最容易出错，再回到题目里验证。`,
    )
    sections.push(
      `### 实战时的拆解顺序\n1. 先写最朴素的思路，确认题目目标。\n2. 再判断需要的数据结构或算法范式。\n3. 最后只优化最卡的一步，不要一开始就把方案写得太重。`,
    )
  }

  if (args.profile.weakTags.length > 0) {
    sections.push(
      `### 结合你最近的训练情况\n你最近更需要补强：${args.profile.weakTags
        .map((item) => `${item.tag}（通过率 ${Math.round(item.completionRate * 100)}%）`)
        .join("、")}。问这类问题时，优先把“为什么错”讲清楚，比直接看答案更有效。`,
    )
  }

  sections.push(
    `### 你下一步可以继续问我\n- “帮我把这道题拆成 3 步解法提示”\n- “只提示状态定义，不要给完整代码”\n- “帮我检查这题最容易错的边界条件”`,
  )

  return sections.join("\n\n")
}

function extractOpenAiContent(data: unknown) {
  if (!data || typeof data !== "object") return null
  const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices
  const content = choices?.[0]?.message?.content
  if (typeof content === "string" && content.trim()) return content.trim()

  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text
        }
        return ""
      })
      .join("")
      .trim()
    return text || null
  }

  return null
}

async function callTutorModel(args: {
  question: string
  profile: AiUserProfileSummary
  focusTags: string[]
  problem: ProblemContext | null
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "")
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"

  const contextLines = [
    `用户最近活跃天数: ${args.profile.activeDays}`,
    `最近尝试题数: ${args.profile.attemptedProblems}`,
    `最近通过题数: ${args.profile.solvedProblems}`,
    `最近通过率: ${Math.round(args.profile.acceptedRate * 100)}%`,
    `弱项标签: ${args.profile.weakTags.map((item) => item.tag).join(", ") || "无"}`,
    `兴趣标签: ${args.profile.interests.join(", ") || "无"}`,
  ]

  if (args.problem) {
    contextLines.push(`题目标题: ${args.problem.title}`)
    contextLines.push(`题目标签: ${args.problem.tags.join(", ") || "无"}`)
    contextLines.push(`题目难度: ${args.problem.difficulty}`)
    if (args.problem.statement) {
      contextLines.push(`题面摘录: ${previewText(args.problem.statement, 600)}`)
    }
    if (args.problem.solutionSummary) {
      contextLines.push(`可用题解摘要: ${previewText(args.problem.solutionSummary, 400)}`)
    }
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是 CodeMaster 的算法辅导教练。请用中文回答，优先给思路拆解、排错提示、学习建议，而不是直接给完整标准答案代码。若上下文不足，请明确指出还缺什么信息。",
        },
        {
          role: "user",
          content: `已知上下文：\n${contextLines.join("\n")}\n\n学生问题：${args.question}\n\n请给出：1. 问题理解 2. 关键提示 3. 下一步建议。`,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)

  if (!response?.ok) {
    return null
  }

  const data = (await response.json().catch(() => null)) as unknown
  return extractOpenAiContent(data)
}

export async function getAiRecommendations(
  viewer: AiViewer,
  query?: Partial<AiRecommendationsQuery>,
): Promise<AiRecommendationsPayload> {
  const signals = await loadLearningSignals(viewer)
  const items = await buildRecommendations(viewer, signals, query)

  return {
    generatedAt: new Date().toISOString(),
    profile: signals.profile,
    items,
  }
}

export async function generateAiLearningPlan(
  viewer: AiViewer,
  input: AiLearningPlanInput,
): Promise<AiLearningPlanPayload> {
  const signals = await loadLearningSignals(viewer)
  const goal = normalizeGoal(input.goal)
  const recommendations = await buildRecommendations(viewer, signals, {
    goal,
    limit: 8,
  })
  const focusTags = pickFocusTags(signals, goal, recommendations)
  const plan = buildPlanDays({
    goal,
    days: input.days ?? AI_PLAN_DEFAULT_DAYS,
    focusTags,
    recommendations,
  })
  const focusPaths = recommendations
    .filter((item) => item.resourceType === "training_path")
    .map((item) => item.title)
    .slice(0, 2)

  return {
    generatedAt: new Date().toISOString(),
    goal,
    windowDays: input.days ?? AI_PLAN_DEFAULT_DAYS,
    summary: buildPlanSummary(goal, signals.profile, focusTags),
    focusTags,
    focusPaths,
    adjustments: buildPlanAdjustments(signals.profile, focusTags, recommendations),
    profile: signals.profile,
    plan,
  }
}

export async function answerAiTutorQuestion(
  viewer: AiViewer,
  input: AiTutorInput,
): Promise<AiTutorPayload> {
  const signals = await loadLearningSignals(viewer)
  const relatedResources = await buildRecommendations(viewer, signals, {
    goal: input.question,
    limit: 4,
  })
  const focusTags = pickFocusTags(signals, input.question, relatedResources)
  const problem = input.problemId ? await loadProblemContext(input.problemId, viewer) : null

  const llmAnswer = await callTutorModel({
    question: input.question,
    profile: signals.profile,
    focusTags,
    problem,
  })

  return {
    generatedAt: new Date().toISOString(),
    mode: llmAnswer ? "llm" : "heuristic",
    question: input.question,
    answer:
      llmAnswer ??
      buildHeuristicTutorAnswer({
        question: input.question,
        profile: signals.profile,
        focusTags,
        problem,
      }),
    followUps: problem
      ? [
          "帮我只提示这题的状态定义，不要给完整代码",
          "帮我检查这题最容易漏掉的边界条件",
          "如果我想继续自己做，应该先验证哪一步",
        ]
      : [
          "结合我最近的弱项，再给我一版更具体的练习建议",
          "把这个知识点拆成适合初学者的 3 步",
          "推荐 2 个适合我当前阶段的训练方向",
        ],
    profile: signals.profile,
    relatedResources,
    context: {
      problemId: problem?.id ?? null,
      problemTitle: problem?.title ?? null,
    },
  }
}
