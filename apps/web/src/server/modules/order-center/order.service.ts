import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { reserveContestRegistrationForOrder } from "@/server/modules/contest-center/registration.service"
import { MEMBERSHIP_PRODUCT_TYPE, LEGACY_VIDEO_MEMBERSHIP_TYPE } from "@/lib/membership"
import { reserveCampEnrollmentForOrder } from "@/server/modules/camp-center/enrollment.service"
import type { OrderDetailResponse, OrderListResponse, RefundRequestResponse } from "@/lib/orders"
import { ensureVipMembershipProduct } from "@/server/modules/membership/service"
import type { CreateOrderInput, OrderListQuery, RefundRequestInput } from "@/server/modules/order-center/schemas"
import {
  OrderCenterError,
  buildBusinessNo,
  mapOrder,
  mapRefundRequest,
  orderArgs,
} from "@/server/modules/order-center/shared"

async function resolveOrderTarget(tx: Prisma.TransactionClient, input: CreateOrderInput) {
  if (input.skuId) {
    const sku = await tx.productSku.findUnique({
      where: { id: input.skuId },
      include: { product: true },
    })

    if (!sku) {
      throw new OrderCenterError("sku_not_found", "SKU 不存在", 404)
    }

    if (input.productId && sku.productId !== input.productId) {
      throw new OrderCenterError("sku_product_mismatch", "SKU 与商品不匹配", 409)
    }

    if (sku.status !== "active" || sku.product.status !== "active") {
      throw new OrderCenterError("sku_inactive", "当前 SKU 暂不可购买", 409)
    }

    return { product: sku.product, sku }
  }

  let product =
    input.productId
      ? await tx.product.findUnique({
          where: { id: input.productId },
          include: {
            skus: {
              where: { status: "active" },
              orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        })
      : null

  if (input.productId && !product) {
    throw new OrderCenterError("product_not_found", "商品不存在", 404)
  }

  if (!product && input.productType) {
    product = await tx.product.findFirst({
      where: {
        type: input.productType,
        status: "active",
      },
      include: {
        skus: {
          where: { status: "active" },
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }, { createdAt: "asc" }],
    })

    if (!product && (input.productType === MEMBERSHIP_PRODUCT_TYPE || input.productType === LEGACY_VIDEO_MEMBERSHIP_TYPE)) {
      product = await ensureVipMembershipProduct(tx)
    }
  }

  if (input.productType && !product) {
    throw new OrderCenterError("product_not_found", "商品不存在", 404)
  }

  if (!product) {
    return { product: null, sku: null }
  }

  if (product.status !== "active") {
    throw new OrderCenterError("product_inactive", "当前商品暂不可购买", 409)
  }

  const sku = product.skus.find((item) => item.isDefault) ?? product.skus[0] ?? null
  return { product, sku }
}

export async function listUserOrders(userId: string, query: OrderListQuery): Promise<OrderListResponse> {
  const skip = (query.page - 1) * query.limit

  const [total, rows] = await Promise.all([
    db.order.count({
      where: { userId },
    }),
    db.order.findMany({
      where: { userId },
      ...orderArgs,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
  ])

  return {
    data: rows.map(mapOrder),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  }
}

export async function getUserOrderDetail(userId: string, orderId: string): Promise<OrderDetailResponse> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    ...orderArgs,
  })

  if (!order || order.userId !== userId) {
    throw new OrderCenterError("not_found", "订单不存在", 404)
  }

  return {
    data: mapOrder(order),
  }
}

export async function createUserOrder(userId: string, input: CreateOrderInput): Promise<OrderDetailResponse> {
  return db.$transaction(async (tx) => {
    const { product, sku } = await resolveOrderTarget(tx, input)
    const amountCents = sku?.priceCents ?? product?.priceCents ?? input.amountCents ?? null

    if (!amountCents || amountCents <= 0) {
      throw new OrderCenterError("invalid_payload", "无法解析订单金额", 400)
    }

    const created = await tx.order.create({
      data: {
        orderNo: buildBusinessNo("ORD"),
        userId,
        productId: product?.id ?? input.productId ?? null,
        skuId: sku?.id ?? null,
        amountCents,
        currency: sku?.currency ?? product?.currency ?? "CNY",
        productNameSnapshot: product?.name ?? null,
        skuNameSnapshot: sku?.name ?? null,
        validDaysSnapshot: sku?.validDays ?? product?.validDays ?? null,
        status: "CREATED",
      },
      ...orderArgs,
    })

    await reserveCampEnrollmentForOrder(tx, created.id)
    await reserveContestRegistrationForOrder(tx, created.id)

    return {
      data: mapOrder(created),
    }
  })
}

export async function createRefundRequestForOrder(
  userId: string,
  orderId: string,
  input: RefundRequestInput,
): Promise<RefundRequestResponse> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      ...orderArgs,
    })

    if (!order || order.userId !== userId) {
      throw new OrderCenterError("not_found", "订单不存在", 404)
    }

    if (order.refundRequest) {
      return {
        data: mapRefundRequest(order.refundRequest)!,
      }
    }

    if (!["PAID", "COMPLETED"].includes(order.status)) {
      throw new OrderCenterError("refund_not_allowed", "只有已支付订单才能申请退款", 409)
    }

    const now = new Date()
    const refundRequest = await tx.refundRequest.create({
      data: {
        refundNo: buildBusinessNo("REF"),
        orderId: order.id,
        userId,
        status: "CREATED",
        reason: input.reason,
        note: input.note,
      },
    })

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "REFUNDING",
        refundRequestedAt: now,
      },
    })

    return {
      data: mapRefundRequest(refundRequest)!,
    }
  })
}
