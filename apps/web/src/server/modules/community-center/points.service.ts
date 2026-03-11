import { Prisma } from "@prisma/client"
import { formatPriceCents } from "@/lib/products"
import type { CommunityRewardItem, PointsSummary } from "@/lib/community"
import { db } from "@/lib/db"
import { grantEntitlementInTx } from "@/server/modules/content-access/service"
import { CommunityError, parseProductRewardPoints } from "@/server/modules/community-center/shared"

const rewardProductArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    skus: {
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    },
  },
})

type RewardProductRecord = Prisma.ProductGetPayload<typeof rewardProductArgs>

function pickDefaultSku(product: RewardProductRecord) {
  return (
    product.skus.find((item) => item.isDefault) ??
    product.skus[0] ?? {
      priceCents: product.priceCents,
      currency: product.currency,
    }
  )
}

export async function awardPointsInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  input: {
    actionType: string
    actionKey?: string
    pointsDelta: number
    relatedType?: string | null
    relatedId?: string | null
    note?: string | null
    metadata?: Prisma.InputJsonValue
  },
) {
  if (input.actionKey) {
    const existing = await tx.pointTransaction.findUnique({
      where: { actionKey: input.actionKey },
    })

    if (existing) {
      return existing
    }
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { pointsBalance: true },
  })

  if (!user) {
    throw new CommunityError("user_not_found", "用户不存在", 404)
  }

  const nextBalance = user.pointsBalance + input.pointsDelta
  if (nextBalance < 0) {
    throw new CommunityError("insufficient_points", "积分余额不足", 400)
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      pointsBalance: nextBalance,
    },
  })

  return tx.pointTransaction.create({
    data: {
      userId,
      actionType: input.actionType,
      actionKey: input.actionKey,
      pointsDelta: input.pointsDelta,
      balanceAfter: nextBalance,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  })
}

export async function getUserPointsSummary(userId: string): Promise<PointsSummary> {
  const [user, transactions, redemptions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    }),
    db.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.pointRedemption.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ])

  return {
    balance: user?.pointsBalance ?? 0,
    recentTransactions: transactions.map((item) => ({
      id: item.id,
      actionType: item.actionType,
      pointsDelta: item.pointsDelta,
      balanceAfter: item.balanceAfter,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
    })),
    recentRedemptions: redemptions.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      pointsCost: item.pointsCost,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
  }
}

export async function listCommunityRewards(userId?: string | null): Promise<CommunityRewardItem[]> {
  const [products, viewer] = await Promise.all([
    db.product.findMany({
      where: {
        status: "active",
        type: {
          in: ["membership", "video_membership", "training_path", "content_pack", "camp", "contest"],
        },
      },
      ...rewardProductArgs,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 24,
    }),
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: { pointsBalance: true },
        })
      : Promise.resolve(null),
  ])

  return products
    .map((product) => {
      const pointsCost = parseProductRewardPoints(product.metadata)
      if (!pointsCost) return null

      const defaultSku = pickDefaultSku(product)
      const currentBalance = viewer?.pointsBalance ?? 0

      return {
        productId: product.id,
        name: product.name,
        summary: product.summary,
        coverImage: product.coverImage,
        type: product.type,
        pointsCost,
        redeemable: currentBalance >= pointsCost,
        currentBalance,
        defaultSkuPriceText: formatPriceCents(defaultSku.priceCents, defaultSku.currency),
      } satisfies CommunityRewardItem
    })
    .filter((item): item is CommunityRewardItem => Boolean(item))
    .sort((left, right) => left.pointsCost - right.pointsCost)
}

export async function redeemProductWithPoints(userId: string, productId: string) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        status: true,
        metadata: true,
      },
    })

    if (!product || product.status !== "active") {
      throw new CommunityError("reward_not_found", "兑换商品不存在", 404)
    }

    const pointsCost = parseProductRewardPoints(product.metadata)
    if (!pointsCost) {
      throw new CommunityError("reward_not_redeemable", "该商品当前不支持积分兑换", 400)
    }

    await awardPointsInTx(tx, userId, {
      actionType: "reward_redeem",
      actionKey: `reward_redeem:${userId}:${product.id}:${Date.now().toString(36)}`,
      pointsDelta: -pointsCost,
      relatedType: "product",
      relatedId: product.id,
      note: `兑换 ${product.name}`,
    })

    await grantEntitlementInTx(tx, userId, "GIFT", product.id, new Date())

    const redemption = await tx.pointRedemption.create({
      data: {
        userId,
        productId: product.id,
        pointsCost,
        status: "completed",
        note: `积分兑换 ${product.name}`,
      },
    })

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    })

    return {
      id: redemption.id,
      status: redemption.status,
      pointsBalance: user?.pointsBalance ?? 0,
    }
  })
}
