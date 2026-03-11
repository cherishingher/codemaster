import { db } from "@/lib/db"
import type {
  ParentBindingInput,
  ParentChildrenResponse,
  ParentLearningOverviewPayload,
} from "@/lib/parent-reports"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import { getCampGraduationReport } from "@/server/modules/camp-center/rank.service"
import { getContestReport } from "@/server/modules/contest-center/service"
import { getLearningWindowDataForUser } from "@/server/modules/learning-report-center/service"
import { getMembershipStatus } from "@/server/modules/membership/service"
import { listParentRecommendedProducts } from "@/server/modules/recommendation-center/service"

type ParentViewer = {
  id?: string | null
  roles?: string[]
}

function buildParentAdvice(args: {
  learningAdvice: string[]
  activeCamp: ParentLearningOverviewPayload["activeCamps"][number] | null
  recentContest: ParentLearningOverviewPayload["recentContests"][number] | null
}) {
  const advice: string[] = []

  if (args.activeCamp) {
    const completionRate =
      args.activeCamp.totalTasks > 0 ? args.activeCamp.completedTasks / args.activeCamp.totalTasks : 0

    if (completionRate < 0.6) {
      advice.push(`训练营「${args.activeCamp.classTitle}」当前任务完成度偏低，建议固定每日时段完成当日任务。`)
    }
  }

  if (args.recentContest) {
    if ((args.recentContest.rank ?? Number.MAX_SAFE_INTEGER) > 10) {
      advice.push(`最近一次模拟赛排名还有提升空间，建议优先完成赛后解析并做 2-3 道同类型复盘题。`)
    } else {
      advice.push(`最近一次模拟赛表现不错，可以继续保持每周参赛和赛后复盘节奏。`)
    }
  }

  advice.push(...args.learningAdvice.map((item) => item.replace("建议", "家长可协助孩子").replace("继续", "家长可鼓励孩子继续")))

  if (advice.length === 0) {
    advice.push("最近学习节奏整体稳定，建议继续保持每周固定训练时段。")
  }

  return advice.slice(0, 4)
}

async function loadChildren(guardianId: string) {
  const relations = await db.guardianRelation.findMany({
    where: {
      guardianUserId: guardianId,
      status: "active",
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  })

  return relations.map((relation) => ({
    studentId: relation.student.id,
    relationId: relation.id,
    relation: relation.relation,
    name: relation.student.name || relation.student.email || "学生",
    email: relation.student.email,
    status: relation.student.status,
    note: relation.note,
  }))
}

export async function createParentBinding(viewer: ParentViewer, input: ParentBindingInput) {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const identifier = input.identifier.trim().toLowerCase()
  if (!identifier) {
    throw new Error("invalid_identifier")
  }

  const student = await db.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: input.identifier.trim() }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  })

  if (!student) {
    throw new Error("student_not_found")
  }

  if (student.id === viewer.id) {
    throw new Error("self_binding_not_allowed")
  }

  const relation = await db.guardianRelation.upsert({
    where: {
      guardianUserId_studentUserId: {
        guardianUserId: viewer.id,
        studentUserId: student.id,
      },
    },
    update: {
      relation: input.relation?.trim() || "parent",
      note: input.note?.trim() || null,
      status: "active",
    },
    create: {
      guardianUserId: viewer.id,
      studentUserId: student.id,
      relation: input.relation?.trim() || "parent",
      note: input.note?.trim() || null,
      status: "active",
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
    },
  })

  return {
    data: {
      studentId: relation.student.id,
      relationId: relation.id,
      relation: relation.relation,
      name: relation.student.name || relation.student.email || "学生",
      email: relation.student.email,
      status: relation.student.status,
      note: relation.note,
    },
  }
}

export async function removeParentBinding(viewer: ParentViewer, relationId: string) {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const relation = await db.guardianRelation.findFirst({
    where: {
      id: relationId,
      guardianUserId: viewer.id,
    },
    select: { id: true },
  })

  if (!relation) {
    throw new Error("binding_not_found")
  }

  await db.guardianRelation.update({
    where: { id: relationId },
    data: { status: "inactive" },
  })
}

export async function listParentChildren(viewer: ParentViewer): Promise<ParentChildrenResponse> {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const items = await loadChildren(viewer.id)
  return {
    data: {
      items,
    },
  }
}

export async function getParentLearningOverview(
  viewer: ParentViewer,
  studentId?: string | null,
): Promise<ParentLearningOverviewPayload> {
  if (!viewer.id) {
    throw new Error("unauthorized")
  }

  const children = await loadChildren(viewer.id)
  const selectedChild = children.find((item) => item.studentId === studentId) ?? children[0] ?? null
  const evaluator = await createContentAccessEvaluator(viewer)
  const enhancedAccess = await evaluator.canAccessLearningReport("enhanced")

  if (!selectedChild) {
    return {
      generatedAt: new Date().toISOString(),
      window: {
        days: 7,
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
      },
      selectedChild: null,
      children,
      overview: null,
      currentTrainingPaths: [],
      activeCamps: [],
      recentContests: [],
      parentAdvice: [],
      recommendedProducts: [],
      emptyState: {
        title: "当前还没有绑定学生",
        description: "先建立家长与学生关系后，这里才会生成孩子最近 7 天的学习、训练营和模拟赛报告。",
      },
      enhancedAccess,
    }
  }

  const [learningData, enrollments, registrations] = await Promise.all([
    getLearningWindowDataForUser(selectedChild.studentId),
    db.campEnrollment.findMany({
      where: {
        userId: selectedChild.studentId,
        status: {
          in: ["ACTIVE", "COMPLETED"],
        },
      },
      include: {
        camp: {
          select: {
            id: true,
            title: true,
          },
        },
        campClass: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            status: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: enhancedAccess.allowed ? 3 : 1,
    }),
    db.contestRegistration.findMany({
      where: {
        userId: selectedChild.studentId,
        status: "JOINED",
      },
      include: {
        contest: {
          select: {
            id: true,
            slug: true,
            name: true,
            endAt: true,
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { joinedAt: "desc" }],
      take: enhancedAccess.allowed ? 4 : 1,
    }),
  ])

  const activeCamps = await Promise.all(
    enrollments.map(async (enrollment) => {
      const report = await getCampGraduationReport(enrollment.classId, selectedChild.studentId)
      return {
        campId: report.campId,
        classId: report.classId,
        campTitle: report.campTitle,
        classTitle: report.classTitle,
        startAt: report.startAt,
        endAt: report.endAt,
        status: report.isGraduated ? "completed" : "active",
        finalRank: report.finalRank ?? null,
        totalTasks: report.totalTasks,
        completedTasks: report.completedTasks,
        acceptanceRate: report.acceptanceRate,
      }
    }),
  )

  const recentContests = await Promise.all(
    registrations.map(async (registration) => {
      const report = await getContestReport(registration.contest.id, {
        id: selectedChild.studentId,
        roles: [],
      })

      return {
        contestId: registration.contest.id,
        contestSlug: registration.contest.slug,
        contestName: registration.contest.name,
        joinedAt: registration.joinedAt.toISOString(),
        status: registration.status,
        rank: report?.result?.rank ?? null,
        groupRank: report?.result?.groupRank ?? null,
        solvedCount: report?.result?.solvedCount ?? 0,
        submissionCount: report?.result?.submissionCount ?? 0,
        reportUnlocked: report?.access.allowed ?? false,
      }
    }),
  )

  const parentAdvice = buildParentAdvice({
    learningAdvice: enhancedAccess.allowed ? learningData.nextStepAdvice : learningData.nextStepAdvice.slice(0, 2),
    activeCamp: activeCamps[0] ?? null,
    recentContest: recentContests[0] ?? null,
  })

  const weakestTags = learningData.tagDistribution
    .filter((item) => item.attemptedProblems >= 2)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 3)
    .map((item) => item.tag)

  const studentMembership = await getMembershipStatus(selectedChild.studentId)

  const recommendedProducts = await listParentRecommendedProducts({
    studentId: selectedChild.studentId,
    weakTags: weakestTags,
    hasActiveMembership: studentMembership.isActive,
    activeCampCount: activeCamps.filter((item) => item.status === "active").length,
    recentContestCount: recentContests.length,
    limit: enhancedAccess.allowed ? 4 : 2,
  })

  await db.parentReportSnapshot.upsert({
    where: {
      guardianUserId_studentUserId_periodType_periodStartAt_periodEndAt: {
        guardianUserId: viewer.id,
        studentUserId: selectedChild.studentId,
        periodType: "weekly",
        periodStartAt: new Date(learningData.window.startAt),
        periodEndAt: new Date(learningData.window.endAt),
      },
    },
    update: {
      summary: `${selectedChild.name} 最近 7 天活跃 ${learningData.overview.activeDays} 天，尝试 ${learningData.overview.attemptedProblems} 题，通过 ${learningData.overview.solvedProblems} 题。`,
      payload: {
        overview: learningData.overview,
        trainingPaths: learningData.trainingPaths.slice(0, 4),
        activeCamps,
        recentContests,
        parentAdvice,
        recommendedProducts,
      },
      generatedAt: new Date(),
    },
    create: {
      guardianUserId: viewer.id,
      studentUserId: selectedChild.studentId,
      periodType: "weekly",
      periodStartAt: new Date(learningData.window.startAt),
      periodEndAt: new Date(learningData.window.endAt),
      summary: `${selectedChild.name} 最近 7 天活跃 ${learningData.overview.activeDays} 天，尝试 ${learningData.overview.attemptedProblems} 题，通过 ${learningData.overview.solvedProblems} 题。`,
      payload: {
        overview: learningData.overview,
        trainingPaths: learningData.trainingPaths.slice(0, 4),
        activeCamps,
        recentContests,
        parentAdvice,
        recommendedProducts,
      },
      generatedAt: new Date(),
    },
  })

  return {
    generatedAt: new Date().toISOString(),
    window: learningData.window,
    selectedChild,
    children,
    overview: learningData.overview,
    currentTrainingPaths: learningData.trainingPaths.slice(0, enhancedAccess.allowed ? 4 : 2),
    activeCamps: enhancedAccess.allowed ? activeCamps : activeCamps.slice(0, 1),
    recentContests: enhancedAccess.allowed ? recentContests : recentContests.slice(0, 1),
    parentAdvice,
    recommendedProducts,
    emptyState: learningData.emptyState
      ? {
          title: learningData.emptyState.title,
          description: learningData.emptyState.description,
        }
      : null,
    enhancedAccess,
  }
}
