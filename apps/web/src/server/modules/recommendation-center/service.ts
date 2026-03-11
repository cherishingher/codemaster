import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type { ContentAccessProductRecommendation } from "@/lib/content-access"

const productArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    skus: {
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    },
    benefits: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    },
  },
})

type ProductRecord = Prisma.ProductGetPayload<typeof productArgs>

export type ParentRecommendationInput = {
  studentId: string
  weakTags?: string[]
  hasActiveMembership?: boolean
  activeCampCount?: number
  recentContestCount?: number
  limit?: number
}

export type ParentRecommendationItem = {
  reason: string
  matchedTags: string[]
  product: ContentAccessProductRecommendation
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

function pickDefaultSku(product: ProductRecord) {
  return (
    product.skus.find((item) => item.isDefault) ??
    product.skus[0] ?? {
      id: `virtual:${product.id}`,
      skuCode: "default",
      name: `${product.name} 标准版`,
      description: null,
      priceCents: product.priceCents,
      originalPriceCents: null,
      currency: product.currency,
      validDays: product.validDays,
      status: "active",
      isDefault: true,
      sortOrder: 0,
      productId: product.id,
      metadata: null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }
  )
}

function mapProduct(product: ProductRecord): ContentAccessProductRecommendation {
  const defaultSku = pickDefaultSku(product)

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    coverImage: product.coverImage,
    type: product.type,
    targetType: product.targetType,
    targetId: product.targetId,
    defaultSku: {
      id: defaultSku.id,
      skuCode: defaultSku.skuCode,
      name: defaultSku.name,
      description: defaultSku.description,
      priceCents: defaultSku.priceCents,
      originalPriceCents: defaultSku.originalPriceCents,
      currency: defaultSku.currency,
      validDays: defaultSku.validDays,
      status: defaultSku.status,
      isDefault: defaultSku.isDefault,
      sortOrder: defaultSku.sortOrder,
    },
    benefits: product.benefits.map((benefit) => ({
      id: benefit.id,
      title: benefit.title,
      description: benefit.description,
      benefitType: benefit.benefitType,
      sortOrder: benefit.sortOrder,
    })),
  }
}

function scoreProduct(
  product: ProductRecord,
  weakTags: string[],
  hasActiveMembership: boolean,
  activeCampCount: number,
  recentContestCount: number,
) {
  const tags = normalizeTags(product.tags)
  const matchedTags = tags.filter((tag) => weakTags.includes(tag))

  let score = 0
  let reason = "推荐继续补充同主题内容"

  if (product.type === "membership" && !hasActiveMembership) {
    score += 120
    reason = "当前还未开通 VIP，可先补齐高级题解、视频解析和增强报告权益。"
  }

  if (product.type === "camp" && activeCampCount === 0) {
    score += 90
    reason = "孩子当前没有进行中的训练营，可以考虑报名阶段性强化营。"
  }

  if (product.type === "contest" && recentContestCount < 2) {
    score += 80
    reason = "最近模拟赛参与次数偏少，可用周期赛保持竞赛节奏。"
  }

  if (product.type === "training_path") {
    score += 70
    reason = matchedTags.length
      ? `最近 ${matchedTags.join(" / ")} 相关题训练较多，可补一条对应专题路径继续巩固。`
      : "可以用专题训练路径持续推进做题节奏。"
  }

  if (product.type === "content_pack") {
    score += 65
    reason = matchedTags.length
      ? `最近 ${matchedTags.join(" / ")} 相关标签是重点练习方向，可补题解内容包做复盘。`
      : "可以用题解内容包补足复盘材料。"
  }

  score += matchedTags.length * 25
  score += Math.max(0, 20 - product.sortOrder)

  return { score, matchedTags, reason }
}

export async function listParentRecommendedProducts(
  input: ParentRecommendationInput,
): Promise<ParentRecommendationItem[]> {
  const weakTags = (input.weakTags ?? []).map((item) => item.trim()).filter(Boolean)
  const limit = input.limit ?? 4
  const now = new Date()

  const [products, entitlements] = await Promise.all([
    db.product.findMany({
      where: {
        status: "active",
        type: {
          in: ["membership", "training_path", "content_pack", "camp", "contest"],
        },
      },
      ...productArgs,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.entitlement.findMany({
      where: {
        userId: input.studentId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        productId: true,
      },
    }),
  ])

  const ownedProductIds = new Set(entitlements.map((item) => item.productId))

  return products
    .filter((product) => !ownedProductIds.has(product.id))
    .filter((product) => !(input.hasActiveMembership && product.type === "membership"))
    .map((product) => {
      const scored = scoreProduct(
        product,
        weakTags,
        Boolean(input.hasActiveMembership),
        input.activeCampCount ?? 0,
        input.recentContestCount ?? 0,
      )

      return {
        ...scored,
        product: mapProduct(product),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "zh-CN"))
    .slice(0, limit)
    .map(({ reason, matchedTags, product }) => ({
      reason,
      matchedTags,
      product,
    }))
}

export async function listLinkedProductsForTargets(args: {
  targets: Array<{ type: string; id: string }>
  tagHints?: string[]
  limit?: number
}): Promise<ContentAccessProductRecommendation[]> {
  const targetClauses = args.targets.map((target) => ({
    targetType: target.type,
    targetId: target.id,
  }))

  const direct = targetClauses.length
    ? await db.product.findMany({
        where: {
          status: "active",
          OR: targetClauses,
        },
        ...productArgs,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: args.limit ?? 4,
      })
    : []

  if (direct.length > 0) {
    return direct.map(mapProduct)
  }

  const tagHints = (args.tagHints ?? []).map((item) => item.trim()).filter(Boolean)
  if (tagHints.length === 0) return []

  const candidates = await db.product.findMany({
    where: { status: "active" },
    ...productArgs,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  return candidates
    .map((product) => ({
      product,
      matched: normalizeTags(product.tags).filter((tag) => tagHints.includes(tag)),
    }))
    .filter((item) => item.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.product.sortOrder - b.product.sortOrder)
    .slice(0, args.limit ?? 4)
    .map((item) => mapProduct(item.product))
}
