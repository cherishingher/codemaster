import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { OrderCenterError } from "@/server/modules/order-center/shared"
import { mapEnrollment } from "@/server/modules/camp-center/shared"

type DbClient = Prisma.TransactionClient | typeof db

const campEnrollmentArgs = Prisma.validator<Prisma.CampEnrollmentDefaultArgs>()({
  include: {
    campClass: {
      select: {
        id: true,
        title: true,
      },
    },
  },
})

async function loadOrderCampOffer(tx: DbClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      productId: true,
      skuId: true,
      status: true,
    },
  })

  if (!order || !order.skuId) {
    return null
  }

  const campSku = await tx.campSku.findUnique({
    where: { productSkuId: order.skuId },
    include: {
      campClass: true,
      camp: true,
    },
  })

  if (!campSku) {
    return null
  }

  return {
    order,
    campSku,
  }
}

export async function loadOccupiedSeatCountMap(
  classIds: string[],
  tx: DbClient = db,
) {
  if (classIds.length === 0) return new Map<string, number>()
  const reservationCutoff = new Date(Date.now() - 30 * 60 * 1000)

  const rows = await tx.campEnrollment.findMany({
    where: {
      classId: { in: classIds },
      OR: [
        {
          status: {
            in: ["ACTIVE", "COMPLETED"],
          },
        },
        {
          status: "PENDING_PAYMENT",
          order: {
            is: {
              status: {
                in: ["CREATED", "PENDING"],
              },
              createdAt: {
                gte: reservationCutoff,
              },
            },
          },
        },
      ],
    },
    select: {
      classId: true,
    },
  })

  const counter = new Map<string, number>()
  for (const row of rows) {
    counter.set(row.classId, (counter.get(row.classId) ?? 0) + 1)
  }

  return counter
}

export async function reserveCampEnrollmentForOrder(
  tx: DbClient,
  orderId: string,
) {
  const resolved = await loadOrderCampOffer(tx, orderId)
  if (!resolved) return null

  const { order, campSku } = resolved
  const existing = await tx.campEnrollment.findFirst({
    where: {
      classId: campSku.classId,
      userId: order.userId,
    },
    include: {
      campClass: {
        select: {
          id: true,
          title: true,
        },
      },
      order: {
        select: {
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (existing) {
    const reservationExpired =
      existing.status === "PENDING_PAYMENT" &&
      existing.order &&
      ["CREATED", "PENDING"].includes(existing.order.status) &&
      existing.order.createdAt.getTime() < Date.now() - 30 * 60 * 1000

    if (reservationExpired) {
      await tx.campEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "CANCELED",
        },
      })
    } else {
      if (existing.orderId === order.id) {
        return mapEnrollment(existing)
      }

      if (!["CANCELED", "REFUNDED"].includes(existing.status)) {
        throw new OrderCenterError("camp_already_joined", "你已经报名过这个训练营班级", 409)
      }
    }
  }

  const occupiedMap = await loadOccupiedSeatCountMap([campSku.classId], tx)
  const occupiedSeats = occupiedMap.get(campSku.classId) ?? 0
  if (typeof campSku.campClass.capacity === "number" && occupiedSeats >= campSku.campClass.capacity) {
    throw new OrderCenterError("camp_full", "当前班级名额已满", 409)
  }

  const created = await tx.campEnrollment.create({
    data: {
      campId: campSku.campId,
      classId: campSku.classId,
      campSkuId: campSku.id,
      userId: order.userId,
      orderId: order.id,
      status: "PENDING_PAYMENT",
      sourceType: "PURCHASE",
      sourceId: order.id,
      enrolledAt: new Date(),
    },
    ...campEnrollmentArgs,
  })

  return mapEnrollment(created)
}

export async function activateCampEnrollmentForOrder(
  tx: DbClient,
  orderId: string,
  activatedAt = new Date(),
) {
  const resolved = await loadOrderCampOffer(tx, orderId)
  if (!resolved) return null

  const { order, campSku } = resolved
  const existing = await tx.campEnrollment.findUnique({
    where: { orderId: order.id },
    ...campEnrollmentArgs,
  })

  if (existing) {
    if (existing.status === "ACTIVE" || existing.status === "COMPLETED") {
      return mapEnrollment(existing)
    }

    const updated = await tx.campEnrollment.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        activatedAt,
        lastActiveAt: activatedAt,
      },
      ...campEnrollmentArgs,
    })

    return mapEnrollment(updated)
  }

  const occupiedMap = await loadOccupiedSeatCountMap([campSku.classId], tx)
  const occupiedSeats = occupiedMap.get(campSku.classId) ?? 0
  if (typeof campSku.campClass.capacity === "number" && occupiedSeats >= campSku.campClass.capacity) {
    throw new OrderCenterError("camp_full", "当前班级名额已满", 409)
  }

  const created = await tx.campEnrollment.create({
    data: {
      campId: campSku.campId,
      classId: campSku.classId,
      campSkuId: campSku.id,
      userId: order.userId,
      orderId: order.id,
      status: "ACTIVE",
      sourceType: "PURCHASE",
      sourceId: order.id,
      enrolledAt: activatedAt,
      activatedAt,
      lastActiveAt: activatedAt,
    },
    ...campEnrollmentArgs,
  })

  return mapEnrollment(created)
}

export async function releaseCampEnrollmentForOrder(
  tx: DbClient,
  orderId: string,
) {
  const enrollment = await tx.campEnrollment.findUnique({
    where: { orderId },
    ...campEnrollmentArgs,
  })

  if (!enrollment || enrollment.status !== "PENDING_PAYMENT") {
    return mapEnrollment(enrollment)
  }

  const updated = await tx.campEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: "CANCELED",
    },
    ...campEnrollmentArgs,
  })

  return mapEnrollment(updated)
}

export async function getCampEnrollmentStatus(
  userId: string,
  campId: string,
) {
  const enrollment = await db.campEnrollment.findFirst({
    where: {
      userId,
      campId,
      status: {
        notIn: ["CANCELED", "REFUNDED"],
      },
    },
    ...campEnrollmentArgs,
    orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
  })

  return mapEnrollment(enrollment)
}

export async function getCampClassEnrollmentStatus(
  userId: string,
  classId: string,
) {
  const enrollment = await db.campEnrollment.findFirst({
    where: {
      userId,
      classId,
      status: {
        notIn: ["CANCELED", "REFUNDED"],
      },
    },
    ...campEnrollmentArgs,
    orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
  })

  return mapEnrollment(enrollment)
}
