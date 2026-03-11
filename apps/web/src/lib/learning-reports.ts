import type { ContentAccessResult, ContentAccessSourceType } from "@/lib/content-access"

export type LearningReportScope = "basic" | "enhanced"
export const LEARNING_REPORT_WINDOW_DAYS = 7

export type LearningReportWindow = {
  days: number
  startAt: string
  endAt: string
}

export type LearningReportOverview = {
  totalSubmissions: number
  attemptedProblems: number
  solvedProblems: number
  acceptedRate: number
  totalAttempts: number
  activeDays: number
  currentStreak: number
  longestStreak: number
  lastSubmissionAt: string | null
}

export type LearningReportDifficultyBreakdown = {
  easy: number
  medium: number
  hard: number
}

export type LearningReportTagItem = {
  tag: string
  attemptedProblems: number
  solvedProblems: number
  completionRate: number
}

export type LearningReportTrendPoint = {
  date: string
  submissions: number
  accepted: number
}

export type LearningReportPathItem = {
  id: string
  slug: string
  title: string
  locked: boolean
  requiredSources: ContentAccessSourceType[]
  completionRate: number
  completedProblems: number
  totalProblems: number
  currentChapterTitle: string | null
  currentProblemTitle: string | null
  lastLearningPositionTitle: string | null
}

export type LearningReportPreview = {
  overview: LearningReportOverview
  solvedBreakdown: LearningReportDifficultyBreakdown
  topTags: LearningReportTagItem[]
  pathHighlights: LearningReportPathItem[]
}

export type LearningReportData = {
  overview: LearningReportOverview
  solvedBreakdown: LearningReportDifficultyBreakdown
  topTags: LearningReportTagItem[]
  trend: LearningReportTrendPoint[]
  trainingPaths: LearningReportPathItem[]
  focusAdvice: string[]
}

export type LearningReportEmptyState = {
  isEmpty: boolean
  title: string
  description: string
}

export type LearningReportOverviewPayload = {
  window: LearningReportWindow
  overview: LearningReportOverview
  currentTrainingPaths: LearningReportPathItem[]
  nextStepAdvice: string[]
  emptyState: LearningReportEmptyState | null
  enhancedAccess: ContentAccessResult
}

export type LearningReportWeeklyPayload = {
  window: LearningReportWindow
  overview: LearningReportOverview
  solvedBreakdown: LearningReportDifficultyBreakdown
  tagDistribution: LearningReportTagItem[]
  trainingPaths: LearningReportPathItem[]
  nextStepAdvice: string[]
  emptyState: LearningReportEmptyState | null
  enhancedAccess: ContentAccessResult
}

export type LearningReportTrendsPayload = {
  window: LearningReportWindow
  trend: LearningReportTrendPoint[]
  emptyState: LearningReportEmptyState | null
  enhancedAccess: ContentAccessResult
}

export type LearningReportOverviewResponse = {
  data: LearningReportOverviewPayload
}

export type LearningReportWeeklyResponse = {
  data: LearningReportWeeklyPayload
}

export type LearningReportTrendsResponse = {
  data: LearningReportTrendsPayload
}

export type LearningReportResponse = {
  data: {
    scope: LearningReportScope
    locked: boolean
    access: ContentAccessResult
    preview: LearningReportPreview
    report: LearningReportData | null
  }
}

export function formatReportRate(value: number) {
  return `${Math.round(value * 100)}%`
}
