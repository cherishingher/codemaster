import { Prisma } from "@prisma/client"
import type {
  CampClassSummary,
  CampEnrollmentView,
  CampOfferView,
} from "@/lib/camps"

export class CampCenterError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export const campSkuArgs = Prisma.validator<Prisma.CampSkuDefaultArgs>()({
  include: {
    product: {
      include: {
        benefits: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    },
    productSku: true,
    campClass: true,
  },
})

export const campClassArgs = Prisma.validator<Prisma.CampClassDefaultArgs>()({
  include: {
    skus: {
      where: { status: "active" },
      include: campSkuArgs.include,
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    },
  },
})

export const campArgs = Prisma.validator<Prisma.CampDefaultArgs>()({
  include: {
    classes: {
      where: {
        status: {
          in: ["enrolling", "active", "completed"],
        },
      },
      include: campClassArgs.include,
      orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }],
    },
  },
})

export type CampSkuRecord = Prisma.CampSkuGetPayload<typeof campSkuArgs>
export type CampClassRecord = Prisma.CampClassGetPayload<typeof campClassArgs>
export type CampRecord = Prisma.CampGetPayload<typeof campArgs>

export function normalizeHighlights(value: Prisma.JsonValue | null): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }

  if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) {
    return value.items.filter((item): item is string => typeof item === "string")
  }

  return []
}

export function mapCampOffer(offer: CampSkuRecord, occupiedSeats: number): CampOfferView {
  const capacity = offer.campClass.capacity
  const availableSeats = typeof capacity === "number" ? Math.max(capacity - occupiedSeats, 0) : null

  return {
    id: offer.id,
    campId: offer.campId,
    classId: offer.classId,
    label: offer.label,
    status: offer.status,
    isDefault: offer.isDefault,
    sortOrder: offer.sortOrder,
    productId: offer.productId,
    productSlug: offer.product.slug,
    productName: offer.product.name,
    productType: offer.product.type,
    skuId: offer.productSkuId,
    skuCode: offer.productSku.skuCode,
    skuName: offer.productSku.name,
    skuDescription: offer.productSku.description,
    priceCents: offer.productSku.priceCents,
    originalPriceCents: offer.productSku.originalPriceCents,
    currency: offer.productSku.currency,
    validDays: offer.productSku.validDays,
    availableSeats,
    occupiedSeats,
    capacity,
    isFull: availableSeats === 0,
  }
}

export function pickDefaultOffer(offers: CampOfferView[]) {
  return offers.find((item) => item.isDefault) ?? offers[0] ?? null
}

export function mapCampClass(record: CampClassRecord, occupiedSeats: number): CampClassSummary {
  const offers = record.skus.map((sku) => mapCampOffer(sku, occupiedSeats))
  const defaultOffer = pickDefaultOffer(offers)
  const availableSeats =
    typeof record.capacity === "number" ? Math.max(record.capacity - occupiedSeats, 0) : null

  return {
    id: record.id,
    slug: record.slug,
    campId: record.campId,
    title: record.title,
    summary: record.summary,
    coachName: record.coachName,
    status: record.status,
    visibility: record.visibility,
    accessLevel: record.accessLevel,
    enrollStartAt: record.enrollStartAt?.toISOString() ?? null,
    enrollEndAt: record.enrollEndAt?.toISOString() ?? null,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    capacity: record.capacity,
    occupiedSeats,
    availableSeats,
    isFull: availableSeats === 0,
    defaultOffer,
    offers,
  }
}

export function mapEnrollment(
  enrollment:
    | (Prisma.CampEnrollmentGetPayload<{
        include: {
          campClass: {
            select: {
              id: true
              title: true
            }
          }
        }
      }>)
    | null
    | undefined,
): CampEnrollmentView | null {
  if (!enrollment) return null

  return {
    id: enrollment.id,
    campId: enrollment.campId,
    classId: enrollment.classId,
    classTitle: enrollment.campClass.title,
    status: enrollment.status,
    sourceType: enrollment.sourceType,
    orderId: enrollment.orderId,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    activatedAt: enrollment.activatedAt?.toISOString() ?? null,
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    lastActiveAt: enrollment.lastActiveAt?.toISOString() ?? null,
  }
}
