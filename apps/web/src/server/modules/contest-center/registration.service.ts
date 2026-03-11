import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { OrderCenterError } from "@/server/modules/order-center/shared"
import { mapContestRegistration } from "@/server/modules/contest-center/shared"

type DbClient = Prisma.TransactionClient | typeof db

const registrationArgs = Prisma.validator<Prisma.ContestRegistrationDefaultArgs>()({
  select: {
    contestId: true,
    status: true,
    orderId: true,
    sourceType: true,
    groupKey: true,
    groupLabel: true,
    joinedAt: true,
    paidAt: true,
  },
})

function isJsonRecord(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getStringMeta(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!isJsonRecord(value)) return null
  const candidate = value[key]
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

async function loadOrderContestTarget(tx: DbClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      product: true,
      sku: true,
    },
  })

  if (!order?.product || order.product.targetType !== "contest" || !order.product.targetId) {
    return null
  }

  const contest = await tx.contest.findUnique({
    where: { id: order.product.targetId },
  })

  if (!contest) {
    return null
  }

  return { order, contest }
}

function resolveContestGroup(order: {
  sku?: { metadata?: Prisma.JsonValue | null } | null
  product?: { metadata?: Prisma.JsonValue | null } | null
}) {
  const groupKey =
    getStringMeta(order.sku?.metadata as Prisma.JsonValue | null | undefined, "contestGroupKey") ??
    getStringMeta(order.product?.metadata as Prisma.JsonValue | null | undefined, "contestGroupKey") ??
    "public"
  const groupLabel =
    getStringMeta(order.sku?.metadata as Prisma.JsonValue | null | undefined, "contestGroupLabel") ??
    getStringMeta(order.product?.metadata as Prisma.JsonValue | null | undefined, "contestGroupLabel") ??
    "公开组"

  return { groupKey, groupLabel }
}

async function syncLegacyContestParticipant(
  tx: DbClient,
  input: {
    contestId: string
    userId: string
    orderId?: string | null
    status: string
    sourceType: string
    sourceId?: string | null
    joinedAt?: Date
    paidAt?: Date | null
  },
) {
  await tx.contestParticipant.upsert({
    where: {
      contestId_userId: {
        contestId: input.contestId,
        userId: input.userId,
      },
    },
    update: {
      orderId: input.orderId ?? null,
      status: input.status,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      joinedAt: input.joinedAt,
      paidAt: input.paidAt ?? null,
    },
    create: {
      contestId: input.contestId,
      userId: input.userId,
      orderId: input.orderId ?? null,
      status: input.status,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      joinedAt: input.joinedAt ?? new Date(),
      paidAt: input.paidAt ?? null,
    },
  })
}

async function loadReservedUserIds(tx: DbClient, contestId: string) {
  const reservationCutoff = new Date(Date.now() - 30 * 60 * 1000)

  const [registrations, participants] = await Promise.all([
    tx.contestRegistration.findMany({
      where: {
        contestId,
        OR: [
          {
            status: "JOINED",
          },
          {
            status: "PENDING_PAYMENT",
            order: {
              is: {
                status: { in: ["CREATED", "PENDING"] },
                createdAt: { gte: reservationCutoff },
              },
            },
          },
        ],
      },
      select: { userId: true },
    }),
    tx.contestParticipant.findMany({
      where: {
        contestId,
        OR: [
          {
            status: "JOINED",
          },
          {
            status: "PENDING_PAYMENT",
            order: {
              is: {
                status: { in: ["CREATED", "PENDING"] },
                createdAt: { gte: reservationCutoff },
              },
            },
          },
        ],
      },
      select: { userId: true },
    }),
  ])

  return new Set([...registrations, ...participants].map((item) => item.userId))
}

export async function reserveContestRegistrationForOrder(tx: DbClient, orderId: string) {
  const resolved = await loadOrderContestTarget(tx, orderId)
  if (!resolved) return null

  const { order, contest } = resolved
  const now = new Date()
  const group = resolveContestGroup(order)
  const existing = await tx.contestRegistration.findUnique({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId: order.userId,
      },
    },
    include: {
      order: {
        select: {
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (contest.registrationStartAt && contest.registrationStartAt > now) {
    throw new OrderCenterError("contest_not_open", "当前模拟赛尚未开始报名", 409)
  }

  if (contest.registrationEndAt && contest.registrationEndAt < now) {
    throw new OrderCenterError("contest_closed", "当前模拟赛报名已结束", 409)
  }

  if (existing) {
    const reservationExpired =
      existing.status === "PENDING_PAYMENT" &&
      existing.order &&
      ["CREATED", "PENDING"].includes(existing.order.status) &&
      existing.order.createdAt.getTime() < Date.now() - 30 * 60 * 1000

    if (reservationExpired) {
      await tx.contestRegistration.update({
        where: {
          contestId_userId: {
            contestId: contest.id,
            userId: order.userId,
          },
        },
        data: {
          status: "CANCELED",
        },
      })
    } else {
      if (existing.orderId === order.id) {
        return mapContestRegistration(existing)
      }

      if (!["CANCELED", "REFUNDED"].includes(existing.status)) {
        throw new OrderCenterError("contest_already_joined", "你已经报名过这场模拟赛", 409)
      }
    }
  }

  if (typeof contest.registrationLimit === "number") {
    const reservedUserIds = await loadReservedUserIds(tx, contest.id)
    if (!reservedUserIds.has(order.userId) && reservedUserIds.size >= contest.registrationLimit) {
      throw new OrderCenterError("contest_full", "当前模拟赛报名名额已满", 409)
    }
  }

  const registration = await tx.contestRegistration.upsert({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId: order.userId,
      },
    },
    update: {
      orderId: order.id,
      status: "PENDING_PAYMENT",
      sourceType: "PURCHASE",
      sourceId: order.id,
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      joinedAt: now,
      paidAt: null,
    },
    create: {
      contestId: contest.id,
      userId: order.userId,
      orderId: order.id,
      status: "PENDING_PAYMENT",
      sourceType: "PURCHASE",
      sourceId: order.id,
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      joinedAt: now,
    },
    ...registrationArgs,
  })

  await syncLegacyContestParticipant(tx, {
    contestId: contest.id,
    userId: order.userId,
    orderId: order.id,
    status: "PENDING_PAYMENT",
    sourceType: "PURCHASE",
    sourceId: order.id,
    joinedAt: now,
    paidAt: null,
  })

  return mapContestRegistration(registration)
}

export async function activateContestRegistrationForOrder(tx: DbClient, orderId: string, paidAt = new Date()) {
  const resolved = await loadOrderContestTarget(tx, orderId)
  if (!resolved) return null

  const { order, contest } = resolved
  const group = resolveContestGroup(order)
  const registration = await tx.contestRegistration.upsert({
    where: {
      contestId_userId: {
        contestId: contest.id,
        userId: order.userId,
      },
    },
    update: {
      orderId: order.id,
      status: "JOINED",
      sourceType: "PURCHASE",
      sourceId: order.id,
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      paidAt,
    },
    create: {
      contestId: contest.id,
      userId: order.userId,
      orderId: order.id,
      status: "JOINED",
      sourceType: "PURCHASE",
      sourceId: order.id,
      groupKey: group.groupKey,
      groupLabel: group.groupLabel,
      joinedAt: paidAt,
      paidAt,
    },
    ...registrationArgs,
  })

  await syncLegacyContestParticipant(tx, {
    contestId: contest.id,
    userId: order.userId,
    orderId: order.id,
    status: "JOINED",
    sourceType: "PURCHASE",
    sourceId: order.id,
    joinedAt: paidAt,
    paidAt,
  })

  return mapContestRegistration(registration)
}

export async function releaseContestRegistrationForOrder(tx: DbClient, orderId: string) {
  const registration = await tx.contestRegistration.findUnique({
    where: { orderId },
    select: {
      userId: true,
      contestId: true,
      status: true,
      orderId: true,
      sourceType: true,
      groupKey: true,
      groupLabel: true,
      joinedAt: true,
      paidAt: true,
    },
  })

  if (registration && registration.status === "PENDING_PAYMENT") {
    const updated = await tx.contestRegistration.update({
      where: { orderId },
      data: {
        status: "CANCELED",
      },
      select: {
        userId: true,
        contestId: true,
        status: true,
        orderId: true,
        sourceType: true,
        groupKey: true,
        groupLabel: true,
        joinedAt: true,
        paidAt: true,
      },
    })

    await syncLegacyContestParticipant(tx, {
      contestId: updated.contestId,
      userId: updated.userId,
      orderId,
      status: "CANCELED",
      sourceType: updated.sourceType,
      joinedAt: new Date(updated.joinedAt),
      paidAt: null,
    })

    return mapContestRegistration(updated)
  }

  const participant = await tx.contestParticipant.findUnique({
    where: { orderId },
    select: {
      contestId: true,
      userId: true,
      orderId: true,
      sourceType: true,
      joinedAt: true,
      paidAt: true,
      status: true,
    },
  })

  if (!participant || participant.status !== "PENDING_PAYMENT") {
    return mapContestRegistration(registration)
  }

  await tx.contestParticipant.update({
    where: { orderId },
    data: {
      status: "CANCELED",
    },
  })

  return mapContestRegistration(registration)
}

export async function getContestRegistrationStatus(userId: string, contestId: string) {
  const registration = await db.contestRegistration.findUnique({
    where: {
      contestId_userId: {
        contestId,
        userId,
      },
    },
    ...registrationArgs,
  })

  if (registration) {
    return mapContestRegistration(registration)
  }

  const participant = await db.contestParticipant.findUnique({
    where: {
      contestId_userId: {
        contestId,
        userId,
      },
    },
    select: {
      contestId: true,
      status: true,
      orderId: true,
      sourceType: true,
      sourceId: true,
      joinedAt: true,
      paidAt: true,
    },
  })

  return mapContestRegistration(participant)
}
