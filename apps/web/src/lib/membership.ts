import type { ProductDetailItem } from "@/lib/products"

export const VIP_MEMBERSHIP_TIER = "VIP" as const
export const MEMBERSHIP_PRODUCT_TYPE = "membership" as const
export const LEGACY_VIDEO_MEMBERSHIP_TYPE = "video_membership" as const
export const MEMBERSHIP_TARGET_TYPE = "membership_plan" as const
export const MEMBERSHIP_TARGET_ID = "vip" as const

export const MEMBERSHIP_ACCESS_KEYS = [
  "advanced_solutions",
  "video_analysis",
  "advanced_training_paths",
  "enhanced_learning_reports",
] as const

export type MembershipAccessKey = (typeof MEMBERSHIP_ACCESS_KEYS)[number]
export type MembershipStatus = "NONE" | "ACTIVE" | "EXPIRED"

export type MembershipBenefitItem = {
  key: MembershipAccessKey
  title: string
  description: string
}

export type MembershipSubscriptionView = {
  tier: string
  status: MembershipStatus
  isActive: boolean
  sourceType: "subscription" | "entitlement" | "none"
  startedAt?: string | null
  expiresAt?: string | null
  remainingDays: number
  renewsFrom: "current_end" | "now"
  productId?: string | null
  productName?: string | null
  skuId?: string | null
  skuName?: string | null
  activeBenefits: MembershipBenefitItem[]
}

export type MembershipMeResponse = {
  data: MembershipSubscriptionView
}

export type MembershipBenefitsResponse = {
  data: {
    tier: string
    benefits: MembershipBenefitItem[]
    product: ProductDetailItem | null
  }
}

export const DEFAULT_MEMBERSHIP_BENEFITS: MembershipBenefitItem[] = [
  {
    key: "advanced_solutions",
    title: "高级题解",
    description: "解锁更完整的题目分析、思路拆解与多解法对比。",
  },
  {
    key: "video_analysis",
    title: "视频解析",
    description: "观看会员专属的视频讲解与关键步骤演示。",
  },
  {
    key: "advanced_training_paths",
    title: "高级训练路径",
    description: "进入更系统的专题训练路径和进阶练习节奏。",
  },
  {
    key: "enhanced_learning_reports",
    title: "增强版学习报告",
    description: "查看更完整的阶段表现、活跃趋势和训练反馈。",
  },
]

export const DEFAULT_VIP_MEMBERSHIP_PRODUCT = {
  name: "VIP 会员",
  summary: "单层 VIP 会员，覆盖高级题解、视频解析、高级训练路径与增强版学习报告。",
  description:
    "一期商业化 MVP 统一使用单层 VIP 会员，续费按到期顺延，到期后自动失效，继续沿用现有商品与订单能力。",
  type: MEMBERSHIP_PRODUCT_TYPE,
  validDays: 30,
  priceCents: 3900,
  currency: "CNY",
  tags: ["VIP", "会员", "高级题解", "视频解析"],
} as const

export function isMembershipProductType(type: string) {
  return type === MEMBERSHIP_PRODUCT_TYPE || type === LEGACY_VIDEO_MEMBERSHIP_TYPE
}

export function formatMembershipDate(value?: string | null) {
  if (!value) return "未开通"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}
