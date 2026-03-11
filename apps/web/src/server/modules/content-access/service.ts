import { Prisma } from "@prisma/client"
import { parseContentPackIncludedTargets } from "@/lib/content-packs"
import { db } from "@/lib/db"
import {
  mapDeniedMessage,
  mapDeniedReasonCode,
  normalizeVisibilityToSources,
  type ContentAccessGrantSource,
  type ContentAccessMatchedEntitlement,
  type ContentAccessPolicy,
  type ContentAccessProductRecommendation,
  type ContentAccessResult,
  type ContentAccessSourceType,
  type ContentAccessTarget,
  type ContentAccessUserSummary,
  type ContentGrantEntitlementSourceType,
  type ContentResourceType,
  type ContentTargetType,
} from "@/lib/content-access"
import { type MembershipSubscriptionView, isMembershipProductType } from "@/lib/membership"
import { getTrainingPathAccessMeta } from "@/lib/training-paths"
import { addDays } from "@/server/modules/order-center/shared"
import { getMembershipBenefits, getMembershipStatus } from "@/server/modules/membership/service"

type AccessViewer = {
  id?: string | null
  roles?: string[]
}

type VideoAccessInput = {
  id: string
  courseId: string
  isPreview: boolean
}

type SolutionAccessInput = {
  id: string
  problemId: string
  visibility: string
  accessLevel?: string | null
  isPremium?: boolean
}

type TrainingPathAccessInput = {
  id: string
  visibility: string
}

type CampAccessInput = {
  id: string
  campId?: string | null
  visibility?: string | null
  accessLevel?: string | null
}

type ContestAccessInput = {
  id: string
  resourceType?: "contest" | "contest_analysis" | "contest_report"
  visibility?: string | null
  accessLevel?: string | null
}

const entitlementProductArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
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

type EntitlementProductRecord = Prisma.ProductGetPayload<typeof entitlementProductArgs>

type ActiveEntitlementRecord = {
  id: string
  productId: string
  sourceType: ContentAccessSourceType
  sourceId: string | null
  expiresAt: Date | null
  product: EntitlementProductRecord
}

type ResolvedViewerContext = {
  viewer: Required<AccessViewer>
  isLoggedIn: boolean
  isAdmin: boolean
  membership: MembershipSubscriptionView | null
  entitlements: ActiveEntitlementRecord[]
  entitlementMap: Map<string, ActiveEntitlementRecord>
}

type GrantResolvedSource = {
  product: {
    id: string
    type: string
    validDays: number | null
  }
  validDays: number | null
}

function normalizeViewer(viewer?: AccessViewer): Required<AccessViewer> {
  return {
    id: viewer?.id ?? null,
    roles: viewer?.roles ?? [],
  }
}

function normalizeSourceType(value?: string | null): ContentAccessSourceType {
  switch ((value ?? "PURCHASE").toUpperCase()) {
    case "MEMBERSHIP":
      return "MEMBERSHIP"
    case "GIFT":
      return "GIFT"
    case "ACTIVITY":
      return "ACTIVITY"
    default:
      return "PURCHASE"
  }
}

function buildTargetKey(type: ContentTargetType, id: string) {
  return `${type}:${id}`
}

function expandTargetKeys(target: ContentAccessTarget) {
  const keys = new Set<string>([buildTargetKey(target.type, target.id)])

  if (target.type === "lesson" || target.type === "video") {
    keys.add(buildTargetKey("lesson", target.id))
    keys.add(buildTargetKey("video", target.id))
  }

  if (target.type === "training_path" || target.type === "problem_set") {
    keys.add(buildTargetKey("training_path", target.id))
    keys.add(buildTargetKey("problem_set", target.id))
  }

  return [...keys]
}

function normalizeProductMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function getProductTargets(product: Pick<EntitlementProductRecord, "metadata" | "targetType" | "targetId">) {
  const targets: ContentAccessTarget[] = []
  const seen = new Set<string>()

  const append = (target: ContentAccessTarget | null) => {
    if (!target?.id) return
    const key = `${target.type}:${target.id}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push(target)
  }

  if (product.targetType && product.targetId) {
    append({
      type: product.targetType as ContentTargetType,
      id: product.targetId,
    })
  }

  for (const target of parseContentPackIncludedTargets(normalizeProductMetadata(product.metadata))) {
    append({
      type: target.type,
      id: target.id,
    })
  }

  return targets
}

function productMatchesPolicyTargets(
  product: Pick<EntitlementProductRecord, "metadata" | "targetType" | "targetId">,
  targets: ContentAccessTarget[],
) {
  if (targets.length === 0) return false

  const productTargetKeys = new Set(getProductTargets(product).flatMap((target) => expandTargetKeys(target)))
  return targets.some((target) => expandTargetKeys(target).some((key) => productTargetKeys.has(key)))
}

function pickDefaultSku(product: EntitlementProductRecord) {
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

function mapRecommendedProduct(product: EntitlementProductRecord): ContentAccessProductRecommendation {
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

async function loadRecommendedProducts(policy: ContentAccessPolicy) {
  const products: ContentAccessProductRecommendation[] = []
  const productMap = new Map<string, ContentAccessProductRecommendation>()

  if (policy.requiredSources.includes("MEMBERSHIP")) {
    const membership = await getMembershipBenefits()
    if (membership.product) {
      productMap.set(membership.product.id, {
        id: membership.product.id,
        slug: membership.product.slug,
        name: membership.product.name,
        summary: membership.product.summary,
        coverImage: membership.product.coverImage,
        type: membership.product.type,
        targetType: membership.product.targetType,
        targetId: membership.product.targetId,
        defaultSku: membership.product.defaultSku,
        benefits: membership.product.benefits,
      })
    }
  }

  if (policy.requiredSources.some((item) => item === "PURCHASE" || item === "GIFT" || item === "ACTIVITY")) {
    const targetClauses = policy.targets.flatMap((target) =>
      expandTargetKeys(target).map((key) => {
        const [type, id] = key.split(":")
        return { targetType: type, targetId: id }
      }),
    )

    const targeted = targetClauses.length
      ? await db.product.findMany({
          where: {
            status: "active",
            OR: targetClauses,
          },
          ...entitlementProductArgs,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })
      : []

    for (const product of targeted) {
      productMap.set(product.id, mapRecommendedProduct(product))
    }

    if (targeted.length === 0) {
      const fallbackTypes =
        policy.resourceType === "training_path"
          ? ["training_path", "membership"]
          : policy.resourceType === "solution"
            ? ["content_pack", "membership"]
            : policy.resourceType === "video"
              ? ["membership", "content_pack", "video_membership"]
                : policy.resourceType === "camp"
                  ? ["camp", "membership"]
                  : policy.resourceType === "contest" ||
                      policy.resourceType === "contest_analysis" ||
                      policy.resourceType === "contest_report"
                    ? ["contest", "membership"]
                    : ["membership"]

      const fallback = await db.product.findMany({
        where: {
          status: "active",
          type: { in: fallbackTypes },
        },
        ...entitlementProductArgs,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 4,
      })

      const prioritizedFallback =
        policy.targets.length > 0 ? fallback.filter((product) => productMatchesPolicyTargets(product, policy.targets)) : []

      for (const product of (prioritizedFallback.length > 0 ? prioritizedFallback : fallback).slice(0, 4)) {
        productMap.set(product.id, mapRecommendedProduct(product))
      }
    }
  }

  products.push(...productMap.values())
  return products
}

async function loadViewerContext(viewer?: AccessViewer): Promise<ResolvedViewerContext> {
  const normalizedViewer = normalizeViewer(viewer)
  const isLoggedIn = Boolean(normalizedViewer.id)
  const isAdmin = normalizedViewer.roles.includes("admin")

  if (!normalizedViewer.id) {
    return {
      viewer: normalizedViewer,
      isLoggedIn,
      isAdmin,
      membership: null,
      entitlements: [],
      entitlementMap: new Map(),
    }
  }

  const now = new Date()
  const [membership, entitlements] = await Promise.all([
    getMembershipStatus(normalizedViewer.id),
    db.entitlement.findMany({
      where: {
        userId: normalizedViewer.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        product: {
          targetType: { not: null },
          targetId: { not: null },
        },
      },
      include: {
        product: {
          include: entitlementProductArgs.include,
        },
      },
      orderBy: [{ grantedAt: "desc" }],
    }),
  ])

  const activeEntitlements: ActiveEntitlementRecord[] = entitlements.map((entitlement) => ({
    id: entitlement.id,
    productId: entitlement.productId,
    sourceType: normalizeSourceType(entitlement.sourceType),
    sourceId: entitlement.sourceId,
    expiresAt: entitlement.expiresAt,
    product: entitlement.product,
  }))

  const entitlementMap = new Map<string, ActiveEntitlementRecord>()
  for (const entitlement of activeEntitlements) {
    for (const target of getProductTargets(entitlement.product)) {
      for (const key of expandTargetKeys({
        type: target.type,
        id: target.id,
      })) {
        if (!entitlementMap.has(key)) {
          entitlementMap.set(key, entitlement)
        }
      }
    }
  }

  return {
    viewer: normalizedViewer,
    isLoggedIn,
    isAdmin,
    membership,
    entitlements: activeEntitlements,
    entitlementMap,
  }
}

function findMatchedEntitlement(
  policy: ContentAccessPolicy,
  context: ResolvedViewerContext,
) {
  for (const target of policy.targets) {
    for (const key of expandTargetKeys(target)) {
      const matched = context.entitlementMap.get(key)
      if (matched) {
        return matched
      }
    }
  }

  return null
}

function buildMatchedEntitlement(
  entitlement: ActiveEntitlementRecord | null,
): ContentAccessMatchedEntitlement | null {
  if (!entitlement) return null

  return {
    id: entitlement.id,
    productId: entitlement.productId,
    productName: entitlement.product.name,
    sourceType: entitlement.sourceType,
    sourceId: entitlement.sourceId,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
  }
}

function buildUserSummary(
  context: ResolvedViewerContext,
  matchedEntitlement: ActiveEntitlementRecord | null,
): ContentAccessUserSummary {
  const activeSources = new Set<ContentAccessSourceType>()

  if (context.membership?.isActive) {
    activeSources.add("MEMBERSHIP")
  }

  for (const entitlement of context.entitlements) {
    activeSources.add(entitlement.sourceType)
  }

  return {
    isLoggedIn: context.isLoggedIn,
    isAdmin: context.isAdmin,
    hasActiveMembership: Boolean(context.membership?.isActive),
    membership: context.membership,
    matchedEntitlement: buildMatchedEntitlement(matchedEntitlement),
    activeSources: [...activeSources],
  }
}

function buildAllowedResult(
  policy: ContentAccessPolicy,
  context: ResolvedViewerContext,
  grantedBy: ContentAccessGrantSource,
  matchedEntitlement: ActiveEntitlementRecord | null,
  recommendedProducts: ContentAccessProductRecommendation[],
): ContentAccessResult {
  const reasonCode =
    grantedBy === "ADMIN"
      ? "ALLOWED_ADMIN"
      : grantedBy === "FREE"
        ? "ALLOWED_FREE"
        : grantedBy === "MEMBERSHIP"
          ? "ALLOWED_MEMBERSHIP"
          : grantedBy === "GIFT"
            ? "ALLOWED_GIFT"
            : grantedBy === "ACTIVITY"
              ? "ALLOWED_ACTIVITY"
              : "ALLOWED_PURCHASE"

  const message =
    grantedBy === "ADMIN"
      ? "管理员可直接访问"
      : grantedBy === "FREE"
        ? "免费资源可直接访问"
        : grantedBy === "MEMBERSHIP"
          ? "已通过 VIP 会员解锁"
          : grantedBy === "GIFT"
            ? "已通过赠送权益解锁"
            : grantedBy === "ACTIVITY"
              ? "已通过活动权益解锁"
              : "已通过已购资源解锁"

  return {
    resourceType: policy.resourceType,
    resourceId: policy.resourceId,
    allowed: true,
    grantedBy,
    reasonCode,
    message,
    visibility: policy.visibility,
    policy: {
      requiredSources: policy.requiredSources,
      targets: policy.targets,
    },
    userSummary: buildUserSummary(context, matchedEntitlement),
    recommendedProducts,
  }
}

function buildDeniedResult(
  policy: ContentAccessPolicy,
  context: ResolvedViewerContext,
  matchedEntitlement: ActiveEntitlementRecord | null,
  recommendedProducts: ContentAccessProductRecommendation[],
): ContentAccessResult {
  return {
    resourceType: policy.resourceType,
    resourceId: policy.resourceId,
    allowed: false,
    grantedBy: null,
    reasonCode: mapDeniedReasonCode(policy.requiredSources, context.isLoggedIn),
    message: mapDeniedMessage(policy.requiredSources, context.isLoggedIn),
    visibility: policy.visibility,
    policy: {
      requiredSources: policy.requiredSources,
      targets: policy.targets,
    },
    userSummary: buildUserSummary(context, matchedEntitlement),
    recommendedProducts,
  }
}

function buildVideoPolicy(input: VideoAccessInput): ContentAccessPolicy {
  return {
    resourceType: "video",
    resourceId: input.id,
    visibility: input.isPreview ? "public" : "membership",
    requiredSources: input.isPreview ? ["FREE"] : ["MEMBERSHIP", "PURCHASE"],
    targets: [
      { type: "video", id: input.id },
      { type: "lesson", id: input.id },
      { type: "course", id: input.courseId },
    ],
  }
}

function buildSolutionPolicy(input: SolutionAccessInput): ContentAccessPolicy {
  const resolvedAccess =
    input.accessLevel?.trim() ||
    (input.isPremium && normalizeVisibilityToSources(input.visibility).includes("FREE")
      ? "membership"
      : input.visibility)

  return {
    resourceType: "solution",
    resourceId: input.id,
    visibility: resolvedAccess,
    requiredSources: normalizeVisibilityToSources(resolvedAccess),
    targets: [
      { type: "solution", id: input.id },
      { type: "problem", id: input.problemId },
    ],
  }
}

function buildTrainingPathPolicy(input: TrainingPathAccessInput): ContentAccessPolicy {
  return {
    resourceType: "training_path",
    resourceId: input.id,
    visibility: input.visibility,
    requiredSources: normalizeVisibilityToSources(input.visibility),
    targets: [
      { type: "training_path", id: input.id },
      { type: "problem_set", id: input.id },
    ],
  }
}

function buildLearningReportPolicy(resourceId = "enhanced"): ContentAccessPolicy {
  return {
    resourceType: "learning_report",
    resourceId,
    visibility: resourceId === "basic" ? "public" : "membership",
    requiredSources: resourceId === "basic" ? ["FREE"] : ["MEMBERSHIP"],
    targets: [{ type: "learning_report", id: resourceId }],
  }
}

function buildCampPolicy(input: CampAccessInput): ContentAccessPolicy {
  const resolvedVisibility = input.accessLevel?.trim() || input.visibility?.trim() || "purchase"

  return {
    resourceType: "camp",
    resourceId: input.id,
    visibility: resolvedVisibility,
    requiredSources: normalizeVisibilityToSources(resolvedVisibility),
    targets: [
      { type: "camp_class", id: input.id },
      {
        type: "camp",
        id: input.campId ?? input.id,
      },
    ],
  }
}

function buildContestPolicy(input: ContestAccessInput): ContentAccessPolicy {
  const resolvedVisibility = input.accessLevel?.trim() || input.visibility?.trim() || "purchase"
  const resourceType = input.resourceType ?? "contest"

  return {
    resourceType,
    resourceId: input.id,
    visibility: resolvedVisibility,
    requiredSources: normalizeVisibilityToSources(resolvedVisibility),
    targets: [{ type: "contest", id: input.id }],
  }
}

async function loadContestUnlockPolicy(
  contestIdOrSlug: string,
  resourceType: "contest" | "contest_analysis" | "contest_report" = "contest",
) {
  const contest = await db.contest.findFirst({
    where: {
      OR: [{ id: contestIdOrSlug }, { slug: contestIdOrSlug }],
    },
    select: {
      id: true,
      visibility: true,
      accessLevel: true,
      endAt: true,
      unlockRules: {
        where: {
          resourceType,
          isEnabled: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
      },
    },
  })

  if (!contest) return null

  const rule = contest.unlockRules[0] ?? null
  const now = new Date()
  const isRuleActive =
    !rule ||
    ((rule.startsAt == null || rule.startsAt <= now) && (rule.endsAt == null || rule.endsAt >= now))

  const fallbackVisibility =
    resourceType === "contest"
      ? contest.accessLevel?.trim() || contest.visibility?.trim() || "purchase"
      : contest.endAt <= now
        ? "purchase"
        : "hidden"

  const resolvedVisibility =
    rule && isRuleActive ? rule.requiredSource.toLowerCase() : fallbackVisibility

  return buildContestPolicy({
    id: contest.id,
    resourceType,
    visibility: resolvedVisibility,
    accessLevel: resolvedVisibility,
  })
}

async function evaluatePolicy(
  policy: ContentAccessPolicy,
  viewer?: AccessViewer,
  preloadedContext?: Promise<ResolvedViewerContext> | ResolvedViewerContext,
) {
  const [context, recommendedProducts] = await Promise.all([
    preloadedContext ? Promise.resolve(preloadedContext) : loadViewerContext(viewer),
    loadRecommendedProducts(policy),
  ])

  if (context.isAdmin) {
    return buildAllowedResult(policy, context, "ADMIN", null, recommendedProducts)
  }

  if (policy.requiredSources.includes("FREE")) {
    return buildAllowedResult(policy, context, "FREE", null, recommendedProducts)
  }

  if (policy.requiredSources.includes("MEMBERSHIP") && context.membership?.isActive) {
    return buildAllowedResult(policy, context, "MEMBERSHIP", null, recommendedProducts)
  }

  const matchedEntitlement = findMatchedEntitlement(policy, context)
  if (matchedEntitlement && policy.requiredSources.includes(matchedEntitlement.sourceType)) {
    return buildAllowedResult(
      policy,
      context,
      matchedEntitlement.sourceType,
      matchedEntitlement,
      recommendedProducts,
    )
  }

  return buildDeniedResult(policy, context, matchedEntitlement, recommendedProducts)
}

async function getResourcePolicy(
  resourceType: ContentResourceType,
  resourceId: string,
): Promise<ContentAccessPolicy | null> {
  switch (resourceType) {
    case "video": {
      const lesson = await db.lesson.findUnique({
        where: { id: resourceId },
        include: {
          section: {
            select: { courseId: true },
          },
        },
      })

      if (!lesson) return null
      return buildVideoPolicy({
        id: lesson.id,
        courseId: lesson.section.courseId,
        isPreview: lesson.isPreview,
      })
    }

    case "solution": {
      const solution = await db.solution.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          problemId: true,
          visibility: true,
          accessLevel: true,
          isPremium: true,
        },
      })

      if (!solution) return null
      return buildSolutionPolicy(solution)
    }

    case "training_path": {
      const trainingPath = getTrainingPathAccessMeta(resourceId)
      if (trainingPath) {
        return buildTrainingPathPolicy(trainingPath)
      }

      const set = await db.problemSet.findUnique({
        where: { id: resourceId },
        select: {
          id: true,
          visibility: true,
        },
      })

      if (!set) return null
      return buildTrainingPathPolicy(set)
    }

    case "learning_report":
      return buildLearningReportPolicy(resourceId)

    case "camp": {
      const campClass = await db.campClass.findFirst({
        where: {
          OR: [{ id: resourceId }, { slug: resourceId }],
        },
        select: {
          id: true,
          campId: true,
          accessLevel: true,
          camp: {
            select: {
              visibility: true,
              accessLevel: true,
            },
          },
        },
      })

      if (campClass) {
        return buildCampPolicy({
          id: campClass.id,
          campId: campClass.campId,
          visibility: campClass.camp.visibility,
          accessLevel: campClass.accessLevel || campClass.camp.accessLevel,
        })
      }

      const camp = await db.camp.findFirst({
        where: {
          OR: [{ id: resourceId }, { slug: resourceId }],
        },
        select: {
          id: true,
          visibility: true,
          accessLevel: true,
        },
      })

      if (!camp) return null
      return buildCampPolicy({
        id: camp.id,
        campId: camp.id,
        visibility: camp.visibility,
        accessLevel: camp.accessLevel,
      })
    }

    case "contest": {
      return loadContestUnlockPolicy(resourceId, "contest")
    }

    case "contest_analysis": {
      return loadContestUnlockPolicy(resourceId, "contest_analysis")
    }

    case "contest_report": {
      return loadContestUnlockPolicy(resourceId, "contest_report")
    }
  }
}

async function resolveGrantSource(
  tx: Prisma.TransactionClient,
  sourceType: ContentGrantEntitlementSourceType,
  sourceId: string,
): Promise<GrantResolvedSource | null> {
  if (sourceType === "PURCHASE") {
    const order = await tx.order.findFirst({
      where: {
        OR: [{ id: sourceId }, { orderNo: sourceId }],
      },
      include: {
        product: true,
        sku: true,
      },
    })

    if (order?.productId && order.product) {
      if (!["PAID", "COMPLETED"].includes(order.status)) {
        return null
      }

      return {
        product: {
          id: order.product.id,
          type: order.product.type,
          validDays: order.product.validDays,
        },
        validDays: order.validDaysSnapshot ?? order.sku?.validDays ?? order.product.validDays ?? null,
      }
    }
  }

  const product = await tx.product.findFirst({
    where: {
      OR: [{ id: sourceId }, { slug: sourceId }],
    },
    select: {
      id: true,
      type: true,
      validDays: true,
    },
  })

  if (!product) return null

  return {
    product,
    validDays: product.validDays,
  }
}

export async function grantEntitlementInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  sourceType: ContentGrantEntitlementSourceType,
  sourceId: string,
  grantedAt = new Date(),
) {
  const resolved = await resolveGrantSource(tx, sourceType, sourceId)
  if (!resolved) {
    throw new Error(`grant_source_not_found:${sourceType}:${sourceId}`)
  }

  if (sourceType === "MEMBERSHIP" && !isMembershipProductType(resolved.product.type)) {
    throw new Error("membership_source_invalid")
  }

  const existing = await tx.entitlement.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: resolved.product.id,
      },
    },
  })

  const expiresAt =
    resolved.validDays && resolved.validDays > 0
      ? addDays(
          existing?.expiresAt && existing.expiresAt > grantedAt ? existing.expiresAt : grantedAt,
          resolved.validDays,
        )
      : null

  const entitlement = await tx.entitlement.upsert({
    where: {
      userId_productId: {
        userId,
        productId: resolved.product.id,
      },
    },
    update: {
      grantedAt,
      expiresAt,
      sourceType,
      sourceId,
    },
    create: {
      userId,
      productId: resolved.product.id,
      grantedAt,
      expiresAt,
      sourceType,
      sourceId,
    },
  })

  return {
    entitlementId: entitlement.id,
    productId: resolved.product.id,
    sourceType,
    expiresAt,
  }
}

export async function grantEntitlement(
  userId: string,
  sourceType: ContentGrantEntitlementSourceType,
  sourceId: string,
) {
  return db.$transaction((tx) => grantEntitlementInTx(tx, userId, sourceType, sourceId))
}

export async function getContentAccessForResource(
  resourceType: ContentResourceType,
  resourceId: string,
  viewer?: AccessViewer,
) {
  const policy = await getResourcePolicy(resourceType, resourceId)
  if (!policy) return null
  return evaluatePolicy(policy, viewer)
}

export async function createContentAccessEvaluator(viewer?: AccessViewer) {
  const normalizedViewer = normalizeViewer(viewer)
  const contextPromise = loadViewerContext(normalizedViewer)

  return {
    userId: normalizedViewer.id,
    roles: normalizedViewer.roles,
    async getUserEntitlements() {
      const context = await contextPromise
      return buildUserSummary(context, null)
    },
    buildVideoPolicy,
    buildSolutionPolicy,
    buildTrainingPathPolicy,
    buildLearningReportPolicy,
    buildCampPolicy,
    buildContestPolicy,
    async canAccessVideo(input: VideoAccessInput) {
      return evaluatePolicy(buildVideoPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessLesson(input: VideoAccessInput) {
      return evaluatePolicy(buildVideoPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessSolution(input: SolutionAccessInput) {
      return evaluatePolicy(buildSolutionPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessTrainingPath(input: TrainingPathAccessInput) {
      return evaluatePolicy(buildTrainingPathPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessProblemSet(input: TrainingPathAccessInput) {
      return evaluatePolicy(buildTrainingPathPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessLearningReport(resourceId = "enhanced") {
      return evaluatePolicy(buildLearningReportPolicy(resourceId), normalizedViewer, contextPromise)
    },
    async canAccessCamp(input: CampAccessInput) {
      return evaluatePolicy(buildCampPolicy(input), normalizedViewer, contextPromise)
    },
    async canAccessContest(input: ContestAccessInput) {
      const policy =
        input.visibility || input.accessLevel
          ? buildContestPolicy(input)
          : await loadContestUnlockPolicy(input.id, "contest")

      if (!policy) {
        throw new Error(`contest_policy_not_found:${input.id}`)
      }

      return evaluatePolicy(policy, normalizedViewer, contextPromise)
    },
    async canAccessContestAnalysis(input: ContestAccessInput) {
      const policy = await loadContestUnlockPolicy(input.id, "contest_analysis")
      if (!policy) {
        throw new Error(`contest_analysis_policy_not_found:${input.id}`)
      }
      return evaluatePolicy(policy, normalizedViewer, contextPromise)
    },
    async canAccessContestReport(input: ContestAccessInput) {
      const policy = await loadContestUnlockPolicy(input.id, "contest_report")
      if (!policy) {
        throw new Error(`contest_report_policy_not_found:${input.id}`)
      }
      return evaluatePolicy(policy, normalizedViewer, contextPromise)
    },
  }
}

export async function getResourceAccessPolicy(
  resourceType: ContentResourceType,
  resourceId: string,
) {
  return getResourcePolicy(resourceType, resourceId)
}
