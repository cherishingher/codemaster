import { Prisma } from "@prisma/client"
import type {
  ContestOfferView,
  ContestParticipantStatus,
  ContestProblemView,
  ContestRegistrationView,
} from "@/lib/contests"

export class ContestCenterError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export const contestArgs = Prisma.validator<Prisma.ContestDefaultArgs>()({
  include: {
    problems: {
      include: {
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
          },
        },
      },
      orderBy: [{ order: "asc" }],
    },
  },
})

export type ContestRecord = Prisma.ContestGetPayload<typeof contestArgs>

export function mapContestProblem(
  item: ContestRecord["problems"][number],
): ContestProblemView {
  return {
    id: item.problem.id,
    slug: item.problem.slug,
    title: item.problem.title,
    difficulty: item.problem.difficulty,
    order: item.order,
  }
}

export function mapContestRegistration(
  participant:
    | (Prisma.ContestParticipantGetPayload<{
        select: {
          contestId: true
          status: true
          orderId: true
          sourceType: true
          sourceId: true
          joinedAt: true
          paidAt: true
        }
      }>)
    | (Prisma.ContestRegistrationGetPayload<{
        select: {
          contestId: true
          status: true
          orderId: true
          sourceType: true
          groupKey: true
          groupLabel: true
          joinedAt: true
          paidAt: true
        }
      }>)
    | null
    | undefined,
): ContestRegistrationView | null {
  if (!participant) return null

  return {
    contestId: participant.contestId,
    status: participant.status as ContestParticipantStatus,
    orderId: participant.orderId,
    sourceType: participant.sourceType,
    groupKey: "groupKey" in participant ? participant.groupKey : null,
    groupLabel: "groupLabel" in participant ? participant.groupLabel : null,
    joinedAt: participant.joinedAt.toISOString(),
    paidAt: participant.paidAt?.toISOString() ?? null,
  }
}

export function mapContestOffer(product: {
  id: string
  slug: string | null
  name: string
  skus: Array<{
    id: string
    name: string
    priceCents: number
    originalPriceCents: number | null
    currency: string
    isDefault: boolean
    sortOrder: number
  }>
}): ContestOfferView | null {
  const sku =
    product.skus.find((item) => item.isDefault) ??
    [...product.skus].sort((a, b) => a.sortOrder - b.sortOrder)[0] ??
    null

  if (!sku) return null

  return {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    skuId: sku.id,
    skuName: sku.name,
    priceCents: sku.priceCents,
    originalPriceCents: sku.originalPriceCents,
    currency: sku.currency,
  }
}
