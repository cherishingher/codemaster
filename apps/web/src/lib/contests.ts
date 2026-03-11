import type { ContentAccessResult } from "@/lib/content-access"

export type ContestParticipantStatus = "PENDING_PAYMENT" | "JOINED" | "CANCELED" | "REFUNDED" | string

export type ContestProblemView = {
  id: string
  slug: string
  title: string
  difficulty: number
  order: number
}

export type ContestOfferView = {
  productId: string
  productSlug?: string | null
  productName: string
  skuId: string
  skuName: string
  priceCents: number
  originalPriceCents?: number | null
  currency: string
}

export type ContestRegistrationView = {
  contestId: string
  status: ContestParticipantStatus
  orderId?: string | null
  sourceType: string
  groupKey?: string | null
  groupLabel?: string | null
  joinedAt: string
  paidAt?: string | null
}

export type ContestRankingItem = {
  rank: number
  userId: string
  userName: string
  solvedCount: number
  submissionCount: number
  penaltyMinutes: number
  isCurrentUser: boolean
  groupKey?: string | null
  groupLabel?: string | null
}

export type ContestResultSummary = {
  contestId: string
  userId: string
  userName: string
  solvedCount: number
  submissionCount: number
  penaltyMinutes: number
  rank: number | null
  groupRank: number | null
  groupKey?: string | null
  groupLabel?: string | null
  isCurrentUser: boolean
}

export type ContestAnalysisItem = {
  problemId: string
  problemSlug: string
  problemTitle: string
  difficulty: number
  order: number
  solutionId?: string | null
  solutionTitle?: string | null
  summary?: string | null
  content?: string | null
  videoUrl?: string | null
  hasVideo: boolean
  locked: boolean
}

export type ContestGroupRankingView = {
  groupKey: string
  groupLabel: string
  items: ContestRankingItem[]
}

export type ContestReportView = {
  contestId: string
  generatedAt: string
  summary: string
  access: ContentAccessResult
  result: ContestResultSummary | null
  globalRankings: ContestRankingItem[]
  groupRankings: ContestGroupRankingView[]
  tagDistribution: Array<{
    tag: string
    count: number
  }>
  nextStepAdvice: string[]
}

export type ContestListItem = {
  id: string
  slug: string
  name: string
  summary?: string | null
  coverImage?: string | null
  status: string
  visibility: string
  accessLevel?: string | null
  startAt: string
  endAt: string
  rule: string
  registrationLimit?: number | null
  registrationCount: number
  availableSeats?: number | null
  isRegistrationOpen: boolean
  problemCount: number
  priceFrom?: {
    priceCents: number
    currency: string
  } | null
  offer?: ContestOfferView | null
  access: ContentAccessResult
  registration?: ContestRegistrationView | null
}

export type ContestDetailItem = ContestListItem & {
  description?: string | null
  problems: ContestProblemView[]
  previewProblems: ContestProblemView[]
  rankings: ContestRankingItem[]
  result: ContestResultSummary | null
  analysisAccess: ContentAccessResult
  reportAccess: ContentAccessResult
}

export type ContestListResponse = {
  data: ContestListItem[]
  meta: {
    total: number
    q?: string | null
  }
}

export type ContestDetailResponse = {
  data: ContestDetailItem
}

export type ContestRegistrationResponse = {
  data: ContestRegistrationView | null
}

export type ContestRankingResponse = {
  data: {
    contestId: string
    items: ContestRankingItem[]
    updatedAt: string
  }
}

export type ContestAnalysisResponse = {
  data: {
    contestId: string
    access: ContentAccessResult
    items: ContestAnalysisItem[]
    previewItems: ContestAnalysisItem[]
  }
}

export type ContestReportResponse = {
  data: ContestReportView
}

export function formatContestDateRange(startAt: string, endAt: string) {
  return `${new Date(startAt).toLocaleString("zh-CN")} - ${new Date(endAt).toLocaleString("zh-CN")}`
}

export function getContestStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "草稿"
    case "published":
      return "已发布"
    case "archived":
      return "已归档"
    default:
      return status
  }
}

export function getContestRegistrationStatusLabel(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "待支付"
    case "JOINED":
      return "已报名"
    case "CANCELED":
      return "已取消"
    case "REFUNDED":
      return "已退款"
    default:
      return status
  }
}
