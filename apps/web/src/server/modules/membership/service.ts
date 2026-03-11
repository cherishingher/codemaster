import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  DEFAULT_MEMBERSHIP_BENEFITS,
  DEFAULT_VIP_MEMBERSHIP_PRODUCT,
  LEGACY_VIDEO_MEMBERSHIP_TYPE,
  MEMBERSHIP_PRODUCT_TYPE,
  MEMBERSHIP_TARGET_ID,
  MEMBERSHIP_TARGET_TYPE,
  type MembershipBenefitItem,
  type MembershipBenefitsResponse,
  type MembershipMeResponse,
  VIP_MEMBERSHIP_TIER,
  isMembershipProductType,
} from "@/lib/membership"
import { getPublicProductDetail } from "@/server/modules/product-center/service"
import { addDays } from "@/server/modules/order-center/shared"

const membershipProductArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
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

type MembershipProductRecord = Prisma.ProductGetPayload<typeof membershipProductArgs>

function membershipProductPriority(product: Pick<MembershipProductRecord, "type" | "targetType" | "targetId">) {
  if (
    product.type === MEMBERSHIP_PRODUCT_TYPE &&
    product.targetType === MEMBERSHIP_TARGET_TYPE &&
    product.targetId === MEMBERSHIP_TARGET_ID
  ) {
    return 0
  }

  if (product.type === MEMBERSHIP_PRODUCT_TYPE) return 1
  if (product.type === LEGACY_VIDEO_MEMBERSHIP_TYPE) return 2
  return 3
}

async function buildUniqueMembershipSlug(tx: Prisma.TransactionClient | typeof db) {
  const seed = "vip-membership"
  let candidate = seed
  let suffix = 1

  while (true) {
    const existing = await tx.product.findFirst({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!existing) return candidate

    suffix += 1
    candidate = `${seed}-${suffix}`
  }
}

async function loadMembershipProducts(
  tx: Prisma.TransactionClient | typeof db,
  onlyActive = true,
) {
  return tx.product.findMany({
    where: {
      ...(onlyActive ? { status: "active" } : {}),
      OR: [
        { type: MEMBERSHIP_PRODUCT_TYPE },
        { type: LEGACY_VIDEO_MEMBERSHIP_TYPE },
      ],
    },
    ...membershipProductArgs,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

function pickMembershipProduct(products: MembershipProductRecord[]) {
  return [...products].sort((left, right) => {
    const priority = membershipProductPriority(left) - membershipProductPriority(right)
    if (priority !== 0) return priority
    return left.createdAt.getTime() - right.createdAt.getTime()
  })[0] ?? null
}

function mapMembershipBenefits(product: MembershipProductRecord | null): MembershipBenefitItem[] {
  const productBenefits = new Map(
    (product?.benefits ?? [])
      .filter((item) => item.benefitType && item.benefitType !== "text")
      .map((item) => [item.benefitType, item]),
  )

  return DEFAULT_MEMBERSHIP_BENEFITS.map((benefit) => {
    const productBenefit = productBenefits.get(benefit.key)
    return {
      key: benefit.key,
      title: productBenefit?.title ?? benefit.title,
      description: productBenefit?.description ?? benefit.description,
    }
  })
}

function mapActiveMembershipBenefits(product: MembershipProductRecord | null, isActive: boolean) {
  return isActive ? mapMembershipBenefits(product) : []
}

export async function ensureVipMembershipProduct(tx: Prisma.TransactionClient | typeof db) {
  const existing = pickMembershipProduct(
    (await loadMembershipProducts(tx)).filter((product) => product.type === MEMBERSHIP_PRODUCT_TYPE),
  )
  if (existing) {
    return existing
  }

  const slug = await buildUniqueMembershipSlug(tx)

  return tx.product.create({
    data: {
      slug,
      name: DEFAULT_VIP_MEMBERSHIP_PRODUCT.name,
      summary: DEFAULT_VIP_MEMBERSHIP_PRODUCT.summary,
      description: DEFAULT_VIP_MEMBERSHIP_PRODUCT.description,
      type: DEFAULT_VIP_MEMBERSHIP_PRODUCT.type,
      status: "active",
      priceCents: DEFAULT_VIP_MEMBERSHIP_PRODUCT.priceCents,
      validDays: DEFAULT_VIP_MEMBERSHIP_PRODUCT.validDays,
      currency: DEFAULT_VIP_MEMBERSHIP_PRODUCT.currency,
      sortOrder: 0,
      tags: DEFAULT_VIP_MEMBERSHIP_PRODUCT.tags as Prisma.InputJsonValue,
      targetType: MEMBERSHIP_TARGET_TYPE,
      targetId: MEMBERSHIP_TARGET_ID,
      skus: {
        create: [
          {
            skuCode: "vip-month",
            name: "VIP 月卡",
            description: "适合短周期体验与密集刷题阶段。",
            priceCents: 3900,
            originalPriceCents: 4900,
            currency: "CNY",
            validDays: 30,
            status: "active",
            isDefault: true,
            sortOrder: 0,
          },
          {
            skuCode: "vip-quarter",
            name: "VIP 季卡",
            description: "适合一个完整专题训练周期。",
            priceCents: 9900,
            originalPriceCents: 11700,
            currency: "CNY",
            validDays: 90,
            status: "active",
            isDefault: false,
            sortOrder: 1,
          },
          {
            skuCode: "vip-year",
            name: "VIP 年卡",
            description: "适合长期学习与完整会员权益覆盖。",
            priceCents: 29900,
            originalPriceCents: 46800,
            currency: "CNY",
            validDays: 365,
            status: "active",
            isDefault: false,
            sortOrder: 2,
          },
        ],
      },
      benefits: {
        create: DEFAULT_MEMBERSHIP_BENEFITS.map((benefit, index) => ({
          title: benefit.title,
          description: benefit.description,
          benefitType: benefit.key,
          sortOrder: index,
        })),
      },
    },
    ...membershipProductArgs,
  })
}

export async function syncExpiredMembershipSubscriptions(
  tx: Prisma.TransactionClient | typeof db,
  userId?: string,
) {
  const now = new Date()

  await tx.membershipSubscription.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: {
        lte: now,
      },
      ...(userId ? { userId } : {}),
    },
    data: {
      status: "EXPIRED",
    },
  })
}

async function loadActiveMembershipEntitlement(userId: string) {
  const now = new Date()

  return db.entitlement.findFirst({
    where: {
      userId,
      AND: [
        {
          OR: [
            { product: { type: MEMBERSHIP_PRODUCT_TYPE } },
            { product: { type: LEGACY_VIDEO_MEMBERSHIP_TYPE } },
          ],
        },
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
    },
    include: {
      product: {
        ...membershipProductArgs,
      },
    },
    orderBy: [{ expiresAt: "desc" }, { grantedAt: "desc" }],
  })
}

function computeRemainingDays(expiresAt?: Date | null) {
  if (!expiresAt) return 0
  const diff = expiresAt.getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86400000)
}

export async function getMembershipStatus(userId: string): Promise<MembershipMeResponse["data"]> {
  await syncExpiredMembershipSubscriptions(db, userId)

  const [subscription, entitlement] = await Promise.all([
    db.membershipSubscription.findUnique({
      where: {
        userId_tier: {
          userId,
          tier: VIP_MEMBERSHIP_TIER,
        },
      },
      include: {
        product: {
          ...membershipProductArgs,
        },
        sku: true,
      },
    }),
    loadActiveMembershipEntitlement(userId),
  ])

  if (subscription) {
    const isActive = subscription.status === "ACTIVE" && subscription.expiresAt > new Date()

    if (isActive) {
      return {
        tier: subscription.tier,
        status: "ACTIVE",
        isActive: true,
        sourceType: "subscription",
        startedAt: subscription.startedAt.toISOString(),
        expiresAt: subscription.expiresAt.toISOString(),
        remainingDays: computeRemainingDays(subscription.expiresAt),
        renewsFrom: "current_end",
        productId: subscription.productId,
        productName: subscription.product.name,
        skuId: subscription.skuId,
        skuName: subscription.sku?.name ?? null,
        activeBenefits: mapActiveMembershipBenefits(subscription.product, true),
      }
    }
  }

  if (entitlement) {
    return {
      tier: VIP_MEMBERSHIP_TIER,
      status: "ACTIVE",
      isActive: true,
      sourceType: "entitlement",
      startedAt: entitlement.grantedAt.toISOString(),
      expiresAt: entitlement.expiresAt?.toISOString() ?? null,
      remainingDays: computeRemainingDays(entitlement.expiresAt),
      renewsFrom: entitlement.expiresAt && entitlement.expiresAt > new Date() ? "current_end" : "now",
      productId: entitlement.productId,
      productName: entitlement.product.name,
      skuId: null,
      skuName: null,
      activeBenefits: mapActiveMembershipBenefits(entitlement.product, true),
    }
  }

  if (subscription) {
    return {
      tier: subscription.tier,
      status: "EXPIRED",
      isActive: false,
      sourceType: "subscription",
      startedAt: subscription.startedAt.toISOString(),
      expiresAt: subscription.expiresAt.toISOString(),
      remainingDays: 0,
      renewsFrom: "now",
      productId: subscription.productId,
      productName: subscription.product.name,
      skuId: subscription.skuId,
      skuName: subscription.sku?.name ?? null,
      activeBenefits: [],
    }
  }

  return {
    tier: VIP_MEMBERSHIP_TIER,
    status: "NONE",
    isActive: false,
    sourceType: "none",
    startedAt: null,
    expiresAt: null,
    remainingDays: 0,
    renewsFrom: "now",
    productId: null,
    productName: null,
    skuId: null,
    skuName: null,
    activeBenefits: [],
  }
}

export async function getMembershipBenefits(): Promise<MembershipBenefitsResponse["data"]> {
  const product = await db.$transaction(async (tx) => ensureVipMembershipProduct(tx))

  return {
    tier: VIP_MEMBERSHIP_TIER,
    benefits: mapMembershipBenefits(product),
    product: await getPublicProductDetail(product.id),
  }
}

export async function hasActiveVipMembership(userId: string, roles: string[] = []) {
  if (roles.includes("admin")) {
    return true
  }

  const membership = await getMembershipStatus(userId)
  return membership.isActive
}

export async function syncMembershipSubscriptionForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  paidAt: Date,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: true,
      sku: true,
    },
  })

  if (!order?.product || !isMembershipProductType(order.product.type)) {
    return { updated: false, expiresAt: null as Date | null }
  }

  const validDays = order.validDaysSnapshot ?? order.sku?.validDays ?? order.product.validDays ?? null
  if (!validDays || validDays <= 0) {
    return { updated: false, expiresAt: null as Date | null }
  }

  await syncExpiredMembershipSubscriptions(tx, order.userId)

  const existing = await tx.membershipSubscription.findUnique({
    where: {
      userId_tier: {
        userId: order.userId,
        tier: VIP_MEMBERSHIP_TIER,
      },
    },
  })

  const effectiveStart =
    existing?.status === "ACTIVE" && existing.expiresAt > paidAt ? existing.expiresAt : paidAt
  const nextExpiresAt = addDays(effectiveStart, validDays)
  const nextStartedAt =
    existing?.status === "ACTIVE" && existing.expiresAt > paidAt ? existing.startedAt : paidAt

  await tx.membershipSubscription.upsert({
    where: {
      userId_tier: {
        userId: order.userId,
        tier: VIP_MEMBERSHIP_TIER,
      },
    },
    update: {
      productId: order.productId!,
      skuId: order.skuId,
      status: "ACTIVE",
      startedAt: nextStartedAt,
      expiresAt: nextExpiresAt,
      lastOrderId: order.id,
    },
    create: {
      userId: order.userId,
      productId: order.productId!,
      skuId: order.skuId,
      tier: VIP_MEMBERSHIP_TIER,
      status: "ACTIVE",
      startedAt: paidAt,
      expiresAt: nextExpiresAt,
      lastOrderId: order.id,
    },
  })

  return {
    updated: true,
    expiresAt: nextExpiresAt,
  }
}
