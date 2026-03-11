import type { ContentAccessResult } from "@/lib/content-access"
import type { LearningReportOverview, LearningReportPathItem, LearningReportWindow } from "@/lib/learning-reports"
import type { ContentAccessProductRecommendation } from "@/lib/content-access"

export type ParentChildView = {
  studentId: string
  relationId: string
  relation: string
  name: string
  email: string | null
  status: string
  note?: string | null
}

export type ParentBindingInput = {
  identifier: string
  relation?: string
  note?: string
}

export type ParentBindingMutationResponse = {
  data: ParentChildView
}

export type ParentRecommendedProductItem = {
  reason: string
  matchedTags: string[]
  product: ContentAccessProductRecommendation
}

export type ParentCampSummaryItem = {
  campId: string
  classId: string
  campTitle: string
  classTitle: string
  startAt: string
  endAt: string
  status: string
  finalRank: number | null
  totalTasks: number
  completedTasks: number
  acceptanceRate: number
}

export type ParentContestSummaryItem = {
  contestId: string
  contestSlug: string
  contestName: string
  joinedAt: string
  status: string
  rank: number | null
  groupRank: number | null
  solvedCount: number
  submissionCount: number
  reportUnlocked: boolean
}

export type ParentLearningOverviewPayload = {
  generatedAt: string
  window: LearningReportWindow
  selectedChild: ParentChildView | null
  children: ParentChildView[]
  overview: LearningReportOverview | null
  currentTrainingPaths: LearningReportPathItem[]
  activeCamps: ParentCampSummaryItem[]
  recentContests: ParentContestSummaryItem[]
  parentAdvice: string[]
  recommendedProducts: ParentRecommendedProductItem[]
  emptyState: {
    title: string
    description: string
  } | null
  enhancedAccess: ContentAccessResult
}

export type ParentChildrenResponse = {
  data: {
    items: ParentChildView[]
  }
}

export type ParentLearningOverviewResponse = {
  data: ParentLearningOverviewPayload
}
