import type {
  LearningReportOverview,
  LearningReportPathItem,
  LearningReportTagItem,
  LearningReportWindow,
} from "@/lib/learning-reports"

export type LearningAnalyticsTrendDirection = "up" | "down" | "flat"
export type LearningAnalyticsRiskLevel = "low" | "medium" | "high"

export type PersonalizedLearningBottleneck = {
  key: string
  title: string
  severity: LearningAnalyticsRiskLevel
  description: string
}

export type PersonalizedLearningTrendSignal = {
  direction: LearningAnalyticsTrendDirection
  summary: string
  recentAcceptedRate: number
  previousAcceptedRate: number
  recentAverageSubmissions: number
  previousAverageSubmissions: number
}

export type PersonalizedLearningPrediction = {
  level: LearningAnalyticsRiskLevel
  score: number
  summary: string
}

export type PersonalizedLearningAnalyticsPayload = {
  window: LearningReportWindow
  overview: LearningReportOverview
  trendSignal: PersonalizedLearningTrendSignal
  strengths: string[]
  weakTags: LearningReportTagItem[]
  focusPaths: LearningReportPathItem[]
  bottlenecks: PersonalizedLearningBottleneck[]
  prediction: PersonalizedLearningPrediction
  actionableSuggestions: string[]
}

export type PlatformLearningKpis = {
  totalUsers: number
  activeUsers: number
  solvedUsers: number
  totalSubmissions: number
  acceptedSubmissions: number
  acceptedRate: number
  avgActiveDays: number
  avgSolvedProblems: number
  campParticipants: number
  contestParticipants: number
}

export type PlatformLearningTrendPoint = {
  date: string
  submissions: number
  accepted: number
  activeUsers: number
}

export type PlatformLearningTagInsight = {
  tag: string
  engagedUsers: number
  attemptedProblems: number
  solvedProblems: number
  completionRate: number
}

export type PlatformPathAdoptionItem = {
  id: string
  slug: string
  title: string
  level: string
  engagedUsers: number
  solvedUsers: number
  engagementRate: number
  solveRate: number
}

export type PlatformBottleneckDistribution = {
  low: number
  medium: number
  high: number
}

export type PlatformLearningOverviewPayload = {
  window: LearningReportWindow
  kpis: PlatformLearningKpis
  topTags: PlatformLearningTagInsight[]
  pathAdoption: PlatformPathAdoptionItem[]
  bottleneckDistribution: PlatformBottleneckDistribution
  recommendations: string[]
}

export type PlatformLearningTrendsPayload = {
  window: LearningReportWindow
  trend: PlatformLearningTrendPoint[]
  signal: {
    direction: LearningAnalyticsTrendDirection
    summary: string
    peakDate: string | null
    lowestDate: string | null
  }
}

export type PersonalizedLearningAnalyticsResponse = {
  data: PersonalizedLearningAnalyticsPayload
}

export type PlatformLearningOverviewResponse = {
  data: PlatformLearningOverviewPayload
}

export type PlatformLearningTrendsResponse = {
  data: PlatformLearningTrendsPayload
}

export function getLearningRiskLabel(level: LearningAnalyticsRiskLevel) {
  switch (level) {
    case "high":
      return "高风险"
    case "medium":
      return "中风险"
    default:
      return "低风险"
  }
}

export function getLearningRiskClass(level: LearningAnalyticsRiskLevel) {
  switch (level) {
    case "high":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700"
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700"
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  }
}
