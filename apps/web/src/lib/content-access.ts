import type { MembershipSubscriptionView } from "@/lib/membership"
import type { ProductBenefitView, ProductSkuView } from "@/lib/products"

export type ContentResourceType =
  | "solution"
  | "video"
  | "training_path"
  | "learning_report"
  | "camp"
  | "contest"
  | "contest_analysis"
  | "contest_report"

export type ContentAccessSourceType = "FREE" | "MEMBERSHIP" | "PURCHASE" | "GIFT" | "ACTIVITY"

export type ContentAccessGrantSource = ContentAccessSourceType | "ADMIN" | null

export type ContentTargetType =
  | "lesson"
  | "video"
  | "course"
  | "solution"
  | "problem"
  | "training_path"
  | "problem_set"
  | "camp"
  | "camp_class"
  | "contest"
  | "learning_report"

export type ContentAccessTarget = {
  type: ContentTargetType
  id: string
}

export type ContentAccessPolicy = {
  resourceType: ContentResourceType
  resourceId: string
  visibility?: string
  requiredSources: ContentAccessSourceType[]
  targets: ContentAccessTarget[]
}

export type ContentAccessProductRecommendation = {
  id: string
  slug?: string | null
  name: string
  summary?: string | null
  coverImage?: string | null
  type: string
  targetType?: string | null
  targetId?: string | null
  defaultSku: ProductSkuView
  benefits: ProductBenefitView[]
}

export type ContentAccessMatchedEntitlement = {
  id: string
  productId: string
  productName: string
  sourceType: ContentAccessSourceType
  sourceId?: string | null
  expiresAt?: string | null
}

export type ContentAccessUserSummary = {
  isLoggedIn: boolean
  isAdmin: boolean
  hasActiveMembership: boolean
  membership: MembershipSubscriptionView | null
  matchedEntitlement: ContentAccessMatchedEntitlement | null
  activeSources: ContentAccessSourceType[]
}

export type ContentAccessReasonCode =
  | "ALLOWED_FREE"
  | "ALLOWED_ADMIN"
  | "ALLOWED_MEMBERSHIP"
  | "ALLOWED_PURCHASE"
  | "ALLOWED_GIFT"
  | "ALLOWED_ACTIVITY"
  | "LOGIN_REQUIRED"
  | "MEMBERSHIP_REQUIRED"
  | "PURCHASE_REQUIRED"
  | "GIFT_REQUIRED"
  | "ACTIVITY_REQUIRED"
  | "MEMBERSHIP_OR_PURCHASE_REQUIRED"
  | "MEMBERSHIP_OR_GIFT_REQUIRED"
  | "MEMBERSHIP_OR_ACTIVITY_REQUIRED"
  | "NOT_AVAILABLE"

export type ContentAccessResult = {
  resourceType: ContentResourceType
  resourceId: string
  allowed: boolean
  grantedBy: ContentAccessGrantSource
  reasonCode: ContentAccessReasonCode
  message: string
  visibility?: string
  policy: {
    requiredSources: ContentAccessSourceType[]
    targets: ContentAccessTarget[]
  }
  userSummary: ContentAccessUserSummary
  recommendedProducts: ContentAccessProductRecommendation[]
}

export type ContentAccessCheckResponse = {
  data: ContentAccessResult
}

export type ContentGrantEntitlementSourceType = Exclude<ContentAccessSourceType, "FREE">

export function normalizeVisibilityToSources(visibility?: string | null): ContentAccessSourceType[] {
  switch ((visibility ?? "public").trim().toLowerCase()) {
    case "public":
    case "free":
      return ["FREE"]
    case "vip":
    case "member":
    case "membership":
      return ["MEMBERSHIP"]
    case "purchase":
    case "paid":
      return ["PURCHASE"]
    case "gift":
      return ["GIFT"]
    case "activity":
      return ["ACTIVITY"]
    case "member_or_purchase":
    case "membership_or_purchase":
    case "protected":
      return ["MEMBERSHIP", "PURCHASE"]
    case "gift_or_membership":
      return ["GIFT", "MEMBERSHIP"]
    case "activity_or_membership":
      return ["ACTIVITY", "MEMBERSHIP"]
    default:
      return []
  }
}

export function formatContentAccessRequirement(requiredSources: ContentAccessSourceType[]): string {
  const normalized = [...new Set(requiredSources)]

  if (normalized.length === 0) return "未开放"
  if (normalized.length === 1) {
    switch (normalized[0]) {
      case "FREE":
        return "免费"
      case "MEMBERSHIP":
        return "VIP"
      case "PURCHASE":
        return "购买"
      case "GIFT":
        return "赠送"
      case "ACTIVITY":
        return "活动"
    }
  }

  const key = [...normalized].sort().join("_")
  switch (key) {
    case "MEMBERSHIP_PURCHASE":
      return "VIP 或购买"
    case "GIFT_MEMBERSHIP":
      return "VIP 或赠送"
    case "ACTIVITY_MEMBERSHIP":
      return "VIP 或活动"
    default:
      return normalized
        .map((item) => formatContentAccessRequirement([item]))
        .join(" / ")
  }
}

export function mapDeniedReasonCode(
  requiredSources: ContentAccessSourceType[],
  isLoggedIn: boolean,
): ContentAccessReasonCode {
  if (!isLoggedIn && requiredSources.some((item) => item !== "FREE")) {
    return "LOGIN_REQUIRED"
  }

  const normalized = [...new Set(requiredSources)].sort().join("_")

  switch (normalized) {
    case "MEMBERSHIP_PURCHASE":
      return "MEMBERSHIP_OR_PURCHASE_REQUIRED"
    case "GIFT_MEMBERSHIP":
      return "MEMBERSHIP_OR_GIFT_REQUIRED"
    case "ACTIVITY_MEMBERSHIP":
      return "MEMBERSHIP_OR_ACTIVITY_REQUIRED"
  }

  if (requiredSources.includes("MEMBERSHIP")) return "MEMBERSHIP_REQUIRED"
  if (requiredSources.includes("PURCHASE")) return "PURCHASE_REQUIRED"
  if (requiredSources.includes("GIFT")) return "GIFT_REQUIRED"
  if (requiredSources.includes("ACTIVITY")) return "ACTIVITY_REQUIRED"
  return "NOT_AVAILABLE"
}

export function mapDeniedMessage(
  requiredSources: ContentAccessSourceType[],
  isLoggedIn: boolean,
) {
  const code = mapDeniedReasonCode(requiredSources, isLoggedIn)

  switch (code) {
    case "LOGIN_REQUIRED":
      return "登录后才能判断并解锁当前内容"
    case "MEMBERSHIP_REQUIRED":
      return "当前内容属于 VIP 权益，需要有效会员后才能访问"
    case "MEMBERSHIP_OR_PURCHASE_REQUIRED":
      return "当前内容需要开通 VIP 或购买对应内容后才能访问"
    case "PURCHASE_REQUIRED":
      return "当前内容需要单独购买对应资源后才能访问"
    case "GIFT_REQUIRED":
      return "当前内容需要通过赠送权益解锁"
    case "MEMBERSHIP_OR_GIFT_REQUIRED":
      return "当前内容需要有效 VIP 或赠送权益后才能访问"
    case "ACTIVITY_REQUIRED":
      return "当前内容需要参与活动并获得权益后才能访问"
    case "MEMBERSHIP_OR_ACTIVITY_REQUIRED":
      return "当前内容需要有效 VIP 或活动权益后才能访问"
    default:
      return "当前内容暂未开放访问"
  }
}
