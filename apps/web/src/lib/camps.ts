import type { ContentAccessResult } from "@/lib/content-access"

export type CampStatus = "draft" | "published" | "archived" | string
export type CampClassStatus = "draft" | "enrolling" | "active" | "completed" | "canceled" | string
export type CampEnrollmentStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELED"
  | "REFUNDED"
  | string
export type CampTaskCompletionStatus = "todo" | "in_progress" | "solved" | "checked_in" | "upcoming"

export type CampOfferView = {
  id: string
  campId: string
  classId: string
  label?: string | null
  status: string
  isDefault: boolean
  sortOrder: number
  productId: string
  productSlug?: string | null
  productName: string
  productType: string
  skuId: string
  skuCode: string
  skuName: string
  skuDescription?: string | null
  priceCents: number
  originalPriceCents?: number | null
  currency: string
  validDays?: number | null
  availableSeats?: number | null
  occupiedSeats: number
  capacity?: number | null
  isFull: boolean
}

export type CampClassSummary = {
  id: string
  slug: string
  campId: string
  title: string
  summary?: string | null
  coachName?: string | null
  status: CampClassStatus
  visibility: string
  accessLevel: string
  enrollStartAt?: string | null
  enrollEndAt?: string | null
  startAt: string
  endAt: string
  capacity?: number | null
  occupiedSeats: number
  availableSeats?: number | null
  isFull: boolean
  defaultOffer?: CampOfferView | null
  offers: CampOfferView[]
}

export type CampEnrollmentView = {
  id: string
  campId: string
  classId: string
  classTitle: string
  status: CampEnrollmentStatus
  sourceType: string
  orderId?: string | null
  enrolledAt: string
  activatedAt?: string | null
  completedAt?: string | null
  lastActiveAt?: string | null
}

export type CampListItem = {
  id: string
  slug: string
  title: string
  summary?: string | null
  coverImage?: string | null
  suitableFor?: string | null
  difficulty?: string | null
  status: CampStatus
  visibility: string
  accessLevel: string
  classCount: number
  activeClassCount: number
  nextStartAt?: string | null
  priceFrom?: {
    priceCents: number
    currency: string
  } | null
  defaultOffer?: CampOfferView | null
  highlights: string[]
  classes: CampClassSummary[]
  myEnrollment?: CampEnrollmentView | null
}

export type CampDetailItem = CampListItem & {
  description?: string | null
}

export type CampTaskItem = {
  id: string
  campId: string
  classId: string
  title: string
  summary?: string | null
  description?: string | null
  taskDate: string
  dayIndex: number
  status: string
  resourceType?: string | null
  resourceId?: string | null
  points: number
  isRequired: boolean
  completionStatus: CampTaskCompletionStatus
  checkedIn: boolean
  solved: boolean
  canCheckin: boolean
  problem?: {
    id: string
    slug: string
    title: string
    difficulty: number
  } | null
}

export type CampRankingItem = {
  rank: number
  userId: string
  userName: string
  score: number
  completedTaskCount: number
  checkinCount: number
  solvedProblemCount: number
  activeDays: number
  isCurrentUser: boolean
}

export type CampRankingView = {
  classId: string
  scope: string
  scopeKey: string
  updatedAt?: string | null
  items: CampRankingItem[]
}

export type CampGraduationReport = {
  campId: string
  classId: string
  campTitle: string
  classTitle: string
  startAt: string
  endAt: string
  isGraduated: boolean
  totalTasks: number
  completedTasks: number
  checkinCount: number
  solvedProblemCount: number
  attemptedProblemCount: number
  acceptanceRate: number
  activeDays: number
  score: number
  finalRank?: number | null
  advice: string[]
}

export type CampClassDetailItem = {
  camp: Pick<CampDetailItem, "id" | "slug" | "title" | "summary" | "coverImage" | "suitableFor" | "difficulty">
  class: CampClassSummary
  access: ContentAccessResult
  enrollment?: CampEnrollmentView | null
  previewTasks: Array<{
    id: string
    title: string
    summary?: string | null
    taskDate: string
    dayIndex: number
    dateKey: string
  }>
  tasks: CampTaskItem[]
  ranking?: CampRankingView | null
  graduationReport?: CampGraduationReport | null
}

export type CampListResponse = {
  data: CampListItem[]
  meta: {
    total: number
    q?: string | null
  }
}

export type CampDetailResponse = {
  data: CampDetailItem
}

export type CampEnrollmentResponse = {
  data: CampEnrollmentView | null
}

export type CampTasksResponse = {
  data: {
    classId: string
    access: ContentAccessResult
    items: CampTaskItem[]
  }
}

export type CampCheckinResponse = {
  data: {
    id: string
    taskId: string
    classId: string
    status: string
    note?: string | null
    checkinAt: string
  }
}

export type CampRankingResponse = {
  data: CampRankingView
}

export type CampGraduationReportResponse = {
  data: {
    access: ContentAccessResult
    report: CampGraduationReport | null
  }
}

export type CampClassDetailResponse = {
  data: CampClassDetailItem
}

export function formatCampDateRange(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  return `${start.toLocaleDateString("zh-CN")} - ${end.toLocaleDateString("zh-CN")}`
}

export function getCampStatusLabel(status: string) {
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

export function getCampClassStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "待开放"
    case "enrolling":
      return "报名中"
    case "active":
      return "进行中"
    case "completed":
      return "已结营"
    case "canceled":
      return "已取消"
    default:
      return status
  }
}

export function getCampEnrollmentStatusLabel(status: string) {
  switch (status) {
    case "PENDING_PAYMENT":
      return "待支付"
    case "ACTIVE":
      return "已入营"
    case "COMPLETED":
      return "已结营"
    case "CANCELED":
      return "已取消"
    case "REFUNDED":
      return "已退款"
    default:
      return status
  }
}

export function getCampTaskCompletionLabel(status: CampTaskCompletionStatus) {
  switch (status) {
    case "checked_in":
      return "已打卡"
    case "solved":
      return "已完成"
    case "in_progress":
      return "进行中"
    case "upcoming":
      return "未开始"
    default:
      return "待完成"
  }
}
