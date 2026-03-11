import { db } from "@/lib/db"
import { UserProblemStatus } from "@/lib/oj"
import type {
  CampGraduationReport,
  CampRankingItem,
  CampRankingResponse,
} from "@/lib/camps"
import { CampCenterError } from "@/server/modules/camp-center/shared"

type UserAggregate = {
  userId: string
  userName: string
  completedTaskCount: number
  checkinCount: number
  solvedProblemCount: number
  attemptedProblemCount: number
  activeDays: number
  score: number
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildAdvice(report: {
  totalTasks: number
  completedTasks: number
  activeDays: number
  acceptanceRate: number
  isGraduated: boolean
}) {
  const advice: string[] = []
  const completionRate = report.totalTasks > 0 ? report.completedTasks / report.totalTasks : 0

  if (completionRate < 0.6) {
    advice.push("优先补齐未完成的每日任务，把训练节奏重新拉回正轨。")
  }

  if (report.activeDays < 4) {
    advice.push("最近班级活跃天数偏少，建议固定每天一个时段完成打卡和做题。")
  }

  if (report.acceptanceRate < 0.5) {
    advice.push("题目通过率偏低，下一阶段先做错题复盘，再补 2-3 道同类型巩固题。")
  }

  if (report.isGraduated && advice.length === 0) {
    advice.push("已经顺利完成本期训练营，可以继续衔接下一阶段专题训练或模拟赛。")
  }

  if (advice.length === 0) {
    advice.push("当前训练节奏稳定，继续保持每日任务和打卡的连续性。")
  }

  return advice.slice(0, 4)
}

async function computeCampRanking(classId: string) {
  const campClass = await db.campClass.findUnique({
    where: { id: classId },
    include: {
      camp: {
        select: {
          id: true,
          title: true,
        },
      },
      enrollments: {
        where: {
          status: {
            in: ["ACTIVE", "COMPLETED"],
          },
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
        orderBy: [{ activatedAt: "asc" }, { createdAt: "asc" }],
      },
      tasks: {
        where: { status: "published" },
        select: {
          id: true,
          problemId: true,
          taskDate: true,
        },
        orderBy: [{ taskDate: "asc" }, { sortOrder: "asc" }],
      },
    },
  })

  if (!campClass) {
    throw new CampCenterError("not_found", "训练营班级不存在", 404)
  }

  const userIds = campClass.enrollments.map((item) => item.userId)
  const taskIds = campClass.tasks.map((item) => item.id)
  const problemIds = campClass.tasks.map((item) => item.problemId).filter((item): item is string => Boolean(item))

  const windowEnd = campClass.endAt < new Date() ? campClass.endAt : new Date()

  const [checkins, progressRows, submissions] = await Promise.all([
    taskIds.length && userIds.length
      ? db.campCheckin.findMany({
          where: {
            classId,
            userId: { in: userIds },
            taskId: { in: taskIds },
          },
          select: {
            userId: true,
            taskId: true,
            checkinAt: true,
          },
        })
      : Promise.resolve([]),
    problemIds.length && userIds.length
      ? db.userProblemProgress.findMany({
          where: {
            userId: { in: userIds },
            problemId: { in: problemIds },
          },
          select: {
            userId: true,
            problemId: true,
            status: true,
            attempts: true,
            solvedAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    problemIds.length && userIds.length
      ? db.submission.findMany({
          where: {
            userId: { in: userIds },
            problemId: { in: problemIds },
            createdAt: {
              gte: campClass.startAt,
              lte: windowEnd,
            },
          },
          select: {
            userId: true,
            problemId: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  const checkinTaskMap = new Map<string, Set<string>>()
  const activeDayMap = new Map<string, Set<string>>()
  for (const checkin of checkins) {
    const taskSet = checkinTaskMap.get(checkin.userId) ?? new Set<string>()
    taskSet.add(checkin.taskId)
    checkinTaskMap.set(checkin.userId, taskSet)

    const daySet = activeDayMap.get(checkin.userId) ?? new Set<string>()
    daySet.add(formatDateKey(checkin.checkinAt))
    activeDayMap.set(checkin.userId, daySet)
  }

  const solvedProblemMap = new Map<string, Set<string>>()
  const attemptedProblemMap = new Map<string, Set<string>>()
  for (const row of progressRows) {
    if (row.attempts > 0) {
      const attemptedSet = attemptedProblemMap.get(row.userId) ?? new Set<string>()
      attemptedSet.add(row.problemId)
      attemptedProblemMap.set(row.userId, attemptedSet)
    }

    const solvedAt = row.solvedAt ?? row.updatedAt
    const solvedInWindow =
      row.status >= UserProblemStatus.ACCEPTED &&
      solvedAt >= campClass.startAt &&
      solvedAt <= windowEnd

    if (solvedInWindow) {
      const solvedSet = solvedProblemMap.get(row.userId) ?? new Set<string>()
      solvedSet.add(row.problemId)
      solvedProblemMap.set(row.userId, solvedSet)
    }
  }

  for (const submission of submissions) {
    const daySet = activeDayMap.get(submission.userId) ?? new Set<string>()
    daySet.add(formatDateKey(submission.createdAt))
    activeDayMap.set(submission.userId, daySet)
  }

  const taskProblemMap = new Map(campClass.tasks.map((task) => [task.id, task.problemId]))
  const aggregates: UserAggregate[] = campClass.enrollments.map((enrollment) => {
    const userId = enrollment.userId
    const checkedTaskIds = checkinTaskMap.get(userId) ?? new Set<string>()
    const solvedProblemIds = solvedProblemMap.get(userId) ?? new Set<string>()
    const attemptedProblemIds = attemptedProblemMap.get(userId) ?? new Set<string>()

    let completedTaskCount = 0
    for (const task of campClass.tasks) {
      const solved = task.problemId ? solvedProblemIds.has(task.problemId) : false
      if (checkedTaskIds.has(task.id) || solved) {
        completedTaskCount += 1
      }
    }

    const activeDays = (activeDayMap.get(userId) ?? new Set<string>()).size
    const checkinCount = checkedTaskIds.size
    const solvedProblemCount = solvedProblemIds.size
    const attemptedProblemCount = attemptedProblemIds.size
    const score = completedTaskCount * 100 + solvedProblemCount * 40 + checkinCount * 20 + activeDays * 10

    return {
      userId,
      userName: enrollment.user.name || enrollment.user.email || "学员",
      completedTaskCount,
      checkinCount,
      solvedProblemCount,
      attemptedProblemCount,
      activeDays,
      score,
    }
  })

  aggregates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.completedTaskCount !== a.completedTaskCount) return b.completedTaskCount - a.completedTaskCount
    if (b.solvedProblemCount !== a.solvedProblemCount) return b.solvedProblemCount - a.solvedProblemCount
    return a.userName.localeCompare(b.userName, "zh-CN")
  })

  const rankingItems: CampRankingItem[] = aggregates.map((item, index) => ({
    rank: index + 1,
    userId: item.userId,
    userName: item.userName,
    score: item.score,
    completedTaskCount: item.completedTaskCount,
    checkinCount: item.checkinCount,
    solvedProblemCount: item.solvedProblemCount,
    activeDays: item.activeDays,
    isCurrentUser: false,
  }))

  await db.$transaction(
    rankingItems.map((item) =>
      db.campRankSnapshot.upsert({
        where: {
          classId_scope_scopeKey_userId: {
            classId,
            scope: "overall",
            scopeKey: "overall",
            userId: item.userId,
          },
        },
        update: {
          rank: item.rank,
          score: item.score,
          completedTaskCount: item.completedTaskCount,
          checkinCount: item.checkinCount,
          solvedProblemCount: item.solvedProblemCount,
          activeDays: item.activeDays,
          userNameSnapshot: item.userName,
          snapshotAt: new Date(),
        },
        create: {
          campId: campClass.campId,
          classId,
          userId: item.userId,
          scope: "overall",
          scopeKey: "overall",
          rank: item.rank,
          score: item.score,
          completedTaskCount: item.completedTaskCount,
          checkinCount: item.checkinCount,
          solvedProblemCount: item.solvedProblemCount,
          activeDays: item.activeDays,
          userNameSnapshot: item.userName,
        },
      }),
    ),
  )

  return {
    campClass,
    items: rankingItems,
    aggregates,
  }
}

export async function getCampRanking(
  classId: string,
  viewerId?: string | null,
  limit = 20,
): Promise<CampRankingResponse> {
  const { items } = await computeCampRanking(classId)
  const topItems = items.slice(0, Math.max(limit, 1)).map((item) => ({
    ...item,
    isCurrentUser: item.userId === viewerId,
  }))

  return {
    data: {
      classId,
      scope: "overall",
      scopeKey: "overall",
      updatedAt: new Date().toISOString(),
      items: topItems,
    },
  }
}

export async function getCampGraduationReport(
  classId: string,
  userId: string,
): Promise<CampGraduationReport> {
  const { campClass, items, aggregates } = await computeCampRanking(classId)
  const aggregate = aggregates.find((item) => item.userId === userId)
  if (!aggregate) {
    throw new CampCenterError("not_enrolled", "当前用户不在这个班级中", 403)
  }

  const finalRank = items.find((item) => item.userId === userId)?.rank ?? null
  const totalTasks = campClass.tasks.length
  const completedTasks = aggregate.completedTaskCount
  const acceptanceRate =
    aggregate.attemptedProblemCount > 0
      ? Number((aggregate.solvedProblemCount / aggregate.attemptedProblemCount).toFixed(4))
      : 0
  const isGraduated = campClass.endAt < new Date() || ["completed", "canceled"].includes(campClass.status)

  return {
    campId: campClass.campId,
    classId: campClass.id,
    campTitle: campClass.camp.title,
    classTitle: campClass.title,
    startAt: campClass.startAt.toISOString(),
    endAt: campClass.endAt.toISOString(),
    isGraduated,
    totalTasks,
    completedTasks,
    checkinCount: aggregate.checkinCount,
    solvedProblemCount: aggregate.solvedProblemCount,
    attemptedProblemCount: aggregate.attemptedProblemCount,
    acceptanceRate,
    activeDays: aggregate.activeDays,
    score: aggregate.score,
    finalRank,
    advice: buildAdvice({
      totalTasks,
      completedTasks,
      activeDays: aggregate.activeDays,
      acceptanceRate,
      isGraduated,
    }),
  }
}
