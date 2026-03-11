import { db } from "@/lib/db"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import { createUserOrder } from "@/server/modules/order-center/order.service"
import { getContestRegistrationStatus } from "@/server/modules/contest-center/registration.service"
import {
  contestArgs,
  ContestCenterError,
  type ContestRecord,
  mapContestOffer,
  mapContestProblem,
} from "@/server/modules/contest-center/shared"
import type {
  ContestAnalysisItem,
  ContestAnalysisResponse,
  ContestDetailItem,
  ContestGroupRankingView,
  ContestListItem,
  ContestRankingItem,
  ContestRankingResponse,
  ContestReportResponse,
  ContestResultSummary,
} from "@/lib/contests"

type ContestViewer = {
  id?: string | null
  roles?: string[]
}

type ContestListQuery = {
  q?: string | null
}

type JoinedContestMember = {
  userId: string
  userName: string
  groupKey: string
  groupLabel: string
}

function buildContestWhere(query?: ContestListQuery) {
  const q = query?.q?.trim()

  return {
    status: "published",
    visibility: {
      not: "hidden",
    },
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              summary: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  }
}

function isRegistrationOpen(contest: ContestRecord, registrationCount: number) {
  const now = new Date()
  if (contest.registrationStartAt && contest.registrationStartAt > now) return false
  if (contest.registrationEndAt && contest.registrationEndAt < now) return false
  if (typeof contest.registrationLimit === "number" && registrationCount >= contest.registrationLimit) return false
  return true
}

function isContestEnded(contest: { endAt: Date }) {
  return contest.endAt <= new Date()
}

function compareRankingItem(a: ContestRankingItem, b: ContestRankingItem) {
  if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount
  if (a.penaltyMinutes !== b.penaltyMinutes) return a.penaltyMinutes - b.penaltyMinutes
  if (a.submissionCount !== b.submissionCount) return a.submissionCount - b.submissionCount
  return a.userName.localeCompare(b.userName, "zh-CN")
}

function mapContestItem(args: {
  contest: ContestRecord
  registrationCount: number
  access: Awaited<ReturnType<Awaited<ReturnType<typeof createContentAccessEvaluator>>["canAccessContest"]>>
  offer: ContestListItem["offer"]
  registration: ContestListItem["registration"]
  analysisAccess: ContestDetailItem["analysisAccess"]
  reportAccess: ContestDetailItem["reportAccess"]
  result: ContestResultSummary | null
}): ContestDetailItem {
  const availableSeats =
    typeof args.contest.registrationLimit === "number"
      ? Math.max(args.contest.registrationLimit - args.registrationCount, 0)
      : null

  return {
    id: args.contest.id,
    slug: args.contest.slug,
    name: args.contest.name,
    summary: args.contest.summary,
    description: args.contest.description,
    coverImage: args.contest.coverImage,
    status: args.contest.status,
    visibility: args.contest.visibility,
    accessLevel: args.contest.accessLevel,
    startAt: args.contest.startAt.toISOString(),
    endAt: args.contest.endAt.toISOString(),
    rule: args.contest.rule,
    registrationLimit: args.contest.registrationLimit,
    registrationCount: args.registrationCount,
    availableSeats,
    isRegistrationOpen: isRegistrationOpen(args.contest, args.registrationCount),
    problemCount: args.contest.problems.length,
    priceFrom: args.offer
      ? {
          priceCents: args.offer.priceCents,
          currency: args.offer.currency,
        }
      : null,
    offer: args.offer,
    access: args.access,
    registration: args.registration,
    previewProblems: [],
    problems: [],
    rankings: [],
    result: args.result,
    analysisAccess: args.analysisAccess,
    reportAccess: args.reportAccess,
  }
}

async function loadContestProductMap(contestIds: string[]) {
  if (contestIds.length === 0) return new Map<string, ContestListItem["offer"]>()

  const products = await db.product.findMany({
    where: {
      status: "active",
      targetType: "contest",
      targetId: {
        in: contestIds,
      },
    },
    include: {
      skus: {
        where: { status: "active" },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  const map = new Map<string, ContestListItem["offer"]>()
  for (const product of products) {
    if (!product.targetId || map.has(product.targetId)) continue
    map.set(product.targetId, mapContestOffer(product))
  }

  return map
}

async function loadRegistrationCounts(contestIds: string[]) {
  if (contestIds.length === 0) return new Map<string, number>()

  const reservationCutoff = new Date(Date.now() - 30 * 60 * 1000)
  const [registrations, participants] = await Promise.all([
    db.contestRegistration.findMany({
      where: {
        contestId: { in: contestIds },
        OR: [
          {
            status: "JOINED",
          },
          {
            status: "PENDING_PAYMENT",
            order: {
              is: {
                status: { in: ["CREATED", "PENDING"] },
                createdAt: { gte: reservationCutoff },
              },
            },
          },
        ],
      },
      select: {
        contestId: true,
        userId: true,
      },
    }),
    db.contestParticipant.findMany({
      where: {
        contestId: { in: contestIds },
        OR: [
          {
            status: "JOINED",
          },
          {
            status: "PENDING_PAYMENT",
            order: {
              is: {
                status: { in: ["CREATED", "PENDING"] },
                createdAt: { gte: reservationCutoff },
              },
            },
          },
        ],
      },
      select: {
        contestId: true,
        userId: true,
      },
    }),
  ])

  const counter = new Map<string, Set<string>>()
  for (const item of [...registrations, ...participants]) {
    const set = counter.get(item.contestId) ?? new Set<string>()
    set.add(item.userId)
    counter.set(item.contestId, set)
  }

  return new Map([...counter.entries()].map(([contestId, users]) => [contestId, users.size]))
}

async function loadContest(idOrSlug: string) {
  return db.contest.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      visibility: {
        not: "hidden",
      },
    },
    ...contestArgs,
  })
}

function isAcceptedStatus(status: string) {
  const normalized = status.toUpperCase()
  return normalized === "AC" || normalized === "ACCEPTED"
}

async function loadJoinedContestMembers(contestId: string): Promise<JoinedContestMember[]> {
  const [registrations, participants] = await Promise.all([
    db.contestRegistration.findMany({
      where: {
        contestId,
        status: "JOINED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    db.contestParticipant.findMany({
      where: {
        contestId,
        status: "JOINED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ])

  const members = new Map<string, JoinedContestMember>()

  for (const registration of registrations) {
    members.set(registration.userId, {
      userId: registration.userId,
      userName: registration.user.name || registration.user.email || "选手",
      groupKey: registration.groupKey,
      groupLabel: registration.groupLabel,
    })
  }

  for (const participant of participants) {
    if (members.has(participant.userId)) continue
    members.set(participant.userId, {
      userId: participant.userId,
      userName: participant.user.name || participant.user.email || "选手",
      groupKey: "public",
      groupLabel: "公开组",
    })
  }

  return [...members.values()]
}

async function buildContestScoreboard(contestId: string, viewerId?: string | null) {
  const contest = await db.contest.findUnique({
    where: { id: contestId },
    include: {
      problems: {
        include: {
          problem: {
            select: {
              id: true,
              slug: true,
              title: true,
              difficulty: true,
              tags: {
                include: {
                  tag: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ order: "asc" }],
      },
    },
  })

  if (!contest) {
    throw new ContestCenterError("not_found", "模拟赛不存在", 404)
  }

  const members = await loadJoinedContestMembers(contest.id)
  const participantIds = members.map((item) => item.userId)
  const problemIds = contest.problems.map((item) => item.problemId)

  const submissions = participantIds.length && problemIds.length
    ? await db.submission.findMany({
        where: {
          userId: { in: participantIds },
          problemId: { in: problemIds },
          createdAt: {
            gte: contest.startAt,
            lte: contest.endAt,
          },
        },
        select: {
          userId: true,
          problemId: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      })
    : []

  const byUserProblem = new Map<string, Array<(typeof submissions)[number]>>()
  for (const submission of submissions) {
    const key = `${submission.userId}:${submission.problemId}`
    const bucket = byUserProblem.get(key) ?? []
    bucket.push(submission)
    byUserProblem.set(key, bucket)
  }

  const globalRanking: ContestRankingItem[] = members.map((member) => {
    let solvedCount = 0
    let submissionCount = 0
    let penaltyMinutes = 0

    for (const problemId of problemIds) {
      const bucket = byUserProblem.get(`${member.userId}:${problemId}`) ?? []
      submissionCount += bucket.length
      let wrongBeforeAc = 0
      let acceptedAt: Date | null = null

      for (const submission of bucket) {
        if (isAcceptedStatus(submission.status)) {
          acceptedAt = submission.createdAt
          break
        }
        wrongBeforeAc += 1
      }

      if (acceptedAt) {
        solvedCount += 1
        const diffMinutes = Math.max(
          Math.floor((acceptedAt.getTime() - contest.startAt.getTime()) / (60 * 1000)),
          0,
        )
        penaltyMinutes += diffMinutes + wrongBeforeAc * 20
      }
    }

    return {
      rank: 0,
      userId: member.userId,
      userName: member.userName,
      solvedCount,
      submissionCount,
      penaltyMinutes,
      isCurrentUser: member.userId === viewerId,
      groupKey: member.groupKey,
      groupLabel: member.groupLabel,
    }
  })

  globalRanking.sort(compareRankingItem)
  const rankedGlobal = globalRanking.map((item, index) => ({
    ...item,
    rank: index + 1,
  }))

  const groupBuckets = new Map<string, ContestRankingItem[]>()
  for (const item of rankedGlobal) {
    const key = item.groupKey || "public"
    const bucket = groupBuckets.get(key) ?? []
    bucket.push(item)
    groupBuckets.set(key, bucket)
  }

  const groupRankMap = new Map<string, number>()
  const groupRankings: ContestGroupRankingView[] = [...groupBuckets.entries()].map(([groupKey, items]) => {
    const sorted = [...items].sort(compareRankingItem).map((item, index) => {
      const groupRank = index + 1
      groupRankMap.set(`${groupKey}:${item.userId}`, groupRank)
      return {
        ...item,
        rank: groupRank,
      }
    })

    return {
      groupKey,
      groupLabel: items[0]?.groupLabel || "公开组",
      items: sorted,
    }
  })

  const resultMap = new Map<string, ContestResultSummary>()
  for (const item of rankedGlobal) {
    resultMap.set(item.userId, {
      contestId: contest.id,
      userId: item.userId,
      userName: item.userName,
      solvedCount: item.solvedCount,
      submissionCount: item.submissionCount,
      penaltyMinutes: item.penaltyMinutes,
      rank: item.rank,
      groupRank: groupRankMap.get(`${item.groupKey || "public"}:${item.userId}`) ?? null,
      groupKey: item.groupKey,
      groupLabel: item.groupLabel,
      isCurrentUser: item.userId === viewerId,
    })
  }

  return {
    contest,
    rankings: rankedGlobal,
    groupRankings,
    resultMap,
  }
}

function buildNextStepAdvice(result: ContestResultSummary | null, tagDistribution: Array<{ tag: string; count: number }>) {
  const advice: string[] = []

  if (!result) {
    return ["先完成模拟赛报名并至少参与一次比赛，系统才会生成个性化赛后建议。"]
  }

  if (result.solvedCount === 0) {
    advice.push("先回看本场题目中最基础的 1-2 道题解，优先补齐破题思路。")
  } else if (result.solvedCount <= 1) {
    advice.push("下一阶段建议围绕本场前两题对应知识点做 3-5 题专题复盘。")
  } else {
    advice.push("你已经完成了本场的核心基础题，接下来建议把复盘重点放到失分题和罚时较高的题目。")
  }

  if (tagDistribution[0]) {
    advice.push(`最近这场比赛里你接触最多的是「${tagDistribution[0].tag}」，建议继续补一条对应训练路径。`)
  }

  if ((result.groupRank ?? Number.MAX_SAFE_INTEGER) > 10) {
    advice.push("当前分组排名还有提升空间，建议固定每周参加一次模拟赛并完成赛后报告复盘。")
  }

  return advice.slice(0, 3)
}

async function buildContestTagDistribution(contestId: string, userId: string) {
  const scoreboard = await buildContestScoreboard(contestId, userId)
  const problemIds = scoreboard.contest.problems.map((item) => item.problemId)

  const progress = await db.userProblemProgress.findMany({
    where: {
      userId,
      problemId: { in: problemIds },
    },
    include: {
      problem: {
        select: {
          tags: {
            include: {
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

  const counter = new Map<string, number>()
  for (const item of progress) {
    for (const tagRef of item.problem.tags) {
      counter.set(tagRef.tag.name, (counter.get(tagRef.tag.name) ?? 0) + 1)
    }
  }

  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

async function upsertContestReport(args: {
  contestId: string
  userId: string
  result: ContestResultSummary | null
  tagDistribution: Array<{ tag: string; count: number }>
  groupRankings: ContestGroupRankingView[]
  summary: string
  nextStepAdvice: string[]
}) {
  const activeGroupRanking =
    args.result?.groupKey
      ? args.groupRankings.find((item) => item.groupKey === args.result?.groupKey)?.items.slice(0, 10) ?? []
      : []

  await db.contestReport.upsert({
    where: {
      contestId_userId_reportType: {
        contestId: args.contestId,
        userId: args.userId,
        reportType: "personal",
      },
    },
    update: {
      solvedCount: args.result?.solvedCount ?? 0,
      submissionCount: args.result?.submissionCount ?? 0,
      penaltyMinutes: args.result?.penaltyMinutes ?? 0,
      score: args.result?.solvedCount ?? 0,
      rank: args.result?.rank ?? null,
      groupRank: args.result?.groupRank ?? null,
      groupKey: args.result?.groupKey ?? null,
      summary: args.summary,
      payload: {
        result: args.result,
        tagDistribution: args.tagDistribution,
        groupRanking: activeGroupRanking,
        nextStepAdvice: args.nextStepAdvice,
      },
      generatedAt: new Date(),
    },
    create: {
      contestId: args.contestId,
      userId: args.userId,
      reportType: "personal",
      groupKey: args.result?.groupKey ?? null,
      solvedCount: args.result?.solvedCount ?? 0,
      submissionCount: args.result?.submissionCount ?? 0,
      penaltyMinutes: args.result?.penaltyMinutes ?? 0,
      score: args.result?.solvedCount ?? 0,
      rank: args.result?.rank ?? null,
      groupRank: args.result?.groupRank ?? null,
      summary: args.summary,
      payload: {
        result: args.result,
        tagDistribution: args.tagDistribution,
        groupRanking: activeGroupRanking,
        nextStepAdvice: args.nextStepAdvice,
      },
      generatedAt: new Date(),
    },
  })
}

export async function getContestRanking(
  contestId: string,
  viewerId?: string | null,
  limit = 50,
): Promise<ContestRankingResponse> {
  const { rankings } = await buildContestScoreboard(contestId, viewerId)

  return {
    data: {
      contestId,
      items: rankings.slice(0, Math.max(limit, 1)),
      updatedAt: new Date().toISOString(),
    },
  }
}

export async function listContests(query: ContestListQuery, viewer?: ContestViewer) {
  const contests = await db.contest.findMany({
    where: buildContestWhere(query),
    ...contestArgs,
    orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }],
  })

  const [offerMap, countMap, evaluator] = await Promise.all([
    loadContestProductMap(contests.map((item) => item.id)),
    loadRegistrationCounts(contests.map((item) => item.id)),
    createContentAccessEvaluator(viewer),
  ])

  const items = await Promise.all(
    contests.map(async (contest) => {
      const [access, registration, analysisAccess, reportAccess] = await Promise.all([
        evaluator.canAccessContest({
          id: contest.id,
          visibility: contest.visibility,
          accessLevel: contest.accessLevel,
        }),
        viewer?.id ? getContestRegistrationStatus(viewer.id, contest.id) : Promise.resolve(null),
        evaluator.canAccessContestAnalysis({ id: contest.id }),
        evaluator.canAccessContestReport({ id: contest.id }),
      ])

      return mapContestItem({
        contest,
        registrationCount: countMap.get(contest.id) ?? 0,
        access,
        offer: offerMap.get(contest.id) ?? null,
        registration,
        analysisAccess,
        reportAccess,
        result: null,
      })
    }),
  )

  return {
    items,
    total: items.length,
    q: query.q ?? null,
  }
}

export async function getContestDetail(idOrSlug: string, viewer?: ContestViewer): Promise<ContestDetailItem | null> {
  const contest = await loadContest(idOrSlug)
  if (!contest || (contest.status !== "published" && !viewer?.roles?.includes("admin"))) {
    return null
  }

  const [offerMap, countMap, evaluator, registration, scoreboard] = await Promise.all([
    loadContestProductMap([contest.id]),
    loadRegistrationCounts([contest.id]),
    createContentAccessEvaluator(viewer),
    viewer?.id ? getContestRegistrationStatus(viewer.id, contest.id) : Promise.resolve(null),
    isContestEnded(contest) ? buildContestScoreboard(contest.id, viewer?.id ?? null) : Promise.resolve(null),
  ])

  const [access, analysisAccess, reportAccess] = await Promise.all([
    evaluator.canAccessContest({
      id: contest.id,
      visibility: contest.visibility,
      accessLevel: contest.accessLevel,
    }),
    evaluator.canAccessContestAnalysis({ id: contest.id }),
    evaluator.canAccessContestReport({ id: contest.id }),
  ])

  const result = viewer?.id && scoreboard ? scoreboard.resultMap.get(viewer.id) ?? null : null
  const base = mapContestItem({
    contest,
    registrationCount: countMap.get(contest.id) ?? 0,
    access,
    offer: offerMap.get(contest.id) ?? null,
    registration,
    analysisAccess,
    reportAccess,
    result,
  })

  return {
    ...base,
    previewProblems: contest.problems.slice(0, 3).map(mapContestProblem),
    problems: access.allowed ? contest.problems.map(mapContestProblem) : [],
    rankings: access.allowed && scoreboard ? scoreboard.rankings.slice(0, 20) : [],
  }
}

export async function createContestRegistrationOrder(contestIdOrSlug: string, user: Required<Pick<ContestViewer, "id">>) {
  const contest = await db.contest.findFirst({
    where: {
      OR: [{ id: contestIdOrSlug }, { slug: contestIdOrSlug }],
      status: "published",
      visibility: {
        not: "hidden",
      },
    },
    select: {
      id: true,
    },
  })

  if (!contest) {
    throw new ContestCenterError("not_found", "模拟赛不存在", 404)
  }

  const product = await db.product.findFirst({
    where: {
      status: "active",
      targetType: "contest",
      targetId: contest.id,
    },
    include: {
      skus: {
        where: {
          status: "active",
        },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  if (!product) {
    throw new ContestCenterError("product_not_found", "当前模拟赛还没有配置报名商品", 409)
  }

  const sku = product.skus.find((item) => item.isDefault) ?? product.skus[0] ?? null
  if (!sku) {
    throw new ContestCenterError("sku_not_found", "当前模拟赛报名商品暂不可购买", 409)
  }

  return createUserOrder(user.id!, {
    productId: product.id,
    skuId: sku.id,
  })
}

export async function getContestAnalysis(
  contestIdOrSlug: string,
  viewer?: ContestViewer,
): Promise<ContestAnalysisResponse["data"] | null> {
  const contest = await loadContest(contestIdOrSlug)
  if (!contest) return null

  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessContestAnalysis({ id: contest.id })
  const problemIds = contest.problems.map((item) => item.problemId)

  const solutions = problemIds.length
    ? await db.solution.findMany({
        where: {
          problemId: { in: problemIds },
          visibility: {
            not: "private",
          },
        },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          videoUrl: true,
          problemId: true,
          type: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }],
      })
    : []

  const bestByProblem = new Map<string, (typeof solutions)[number]>()
  for (const solution of solutions) {
    if (!bestByProblem.has(solution.problemId)) {
      bestByProblem.set(solution.problemId, solution)
    }
  }

  const mapped: ContestAnalysisItem[] = contest.problems.map((item) => {
    const solution = bestByProblem.get(item.problemId)
    return {
      problemId: item.problem.id,
      problemSlug: item.problem.slug,
      problemTitle: item.problem.title,
      difficulty: item.problem.difficulty,
      order: item.order,
      solutionId: solution?.id ?? null,
      solutionTitle: solution?.title ?? null,
      summary: solution?.summary ?? null,
      content: access.allowed ? solution?.content ?? null : null,
      videoUrl: access.allowed ? solution?.videoUrl ?? null : null,
      hasVideo: Boolean(solution?.videoUrl),
      locked: !access.allowed,
    }
  })

  return {
    contestId: contest.id,
    access,
    items: access.allowed ? mapped : [],
    previewItems: mapped.slice(0, 3).map((item) => ({
      ...item,
      content: null,
      videoUrl: null,
      locked: !access.allowed,
    })),
  }
}

export async function getContestReport(
  contestIdOrSlug: string,
  viewer?: ContestViewer,
): Promise<ContestReportResponse["data"] | null> {
  const contest = await loadContest(contestIdOrSlug)
  if (!contest) return null

  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessContestReport({ id: contest.id })
  const scoreboard = await buildContestScoreboard(contest.id, viewer?.id ?? null)
  const result = viewer?.id ? scoreboard.resultMap.get(viewer.id) ?? null : null
  const tagDistribution = viewer?.id ? await buildContestTagDistribution(contest.id, viewer.id) : []
  const summary =
    result
      ? `你在本场模拟赛中完成 ${result.solvedCount} 题，提交 ${result.submissionCount} 次，当前总榜第 ${result.rank ?? "-"} 名。`
      : "当前还没有生成你的个人赛后报告。"
  const nextStepAdvice = buildNextStepAdvice(result, tagDistribution)

  if (viewer?.id) {
    await upsertContestReport({
      contestId: contest.id,
      userId: viewer.id,
      result,
      tagDistribution,
      groupRankings: scoreboard.groupRankings,
      summary,
      nextStepAdvice,
    })
  }

  return {
    contestId: contest.id,
    generatedAt: new Date().toISOString(),
    summary,
    access,
    result: access.allowed ? result : null,
    globalRankings: access.allowed ? scoreboard.rankings.slice(0, 20) : [],
    groupRankings: access.allowed ? scoreboard.groupRankings.map((item) => ({ ...item, items: item.items.slice(0, 10) })) : [],
    tagDistribution: access.allowed ? tagDistribution : [],
    nextStepAdvice: access.allowed ? nextStepAdvice : [],
  }
}
