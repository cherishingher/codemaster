import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import type { OrderItem, OrderPaymentItem, PaymentItem, RefundRequestItem } from "@/lib/orders"

export class OrderCenterError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export const orderArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  include: {
    product: true,
    sku: true,
    payments: {
      orderBy: [{ createdAt: "desc" }],
    },
    refundRequest: true,
  },
})

export const paymentArgs = Prisma.validator<Prisma.PaymentDefaultArgs>()({
  include: {
    order: {
      include: {
        product: true,
        sku: true,
        payments: {
          orderBy: [{ createdAt: "desc" }],
        },
        refundRequest: true,
      },
    },
  },
})

export type OrderWithRelations = Prisma.OrderGetPayload<typeof orderArgs>
export type PaymentWithRelations = Prisma.PaymentGetPayload<typeof paymentArgs>

export function buildBusinessNo(prefix: "ORD" | "PAY" | "REF") {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
    String(now.getMilliseconds()).padStart(3, "0"),
  ].join("")

  return `${prefix}${stamp}${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

export function mapRefundRequest(
  refundRequest: OrderWithRelations["refundRequest"] | PaymentWithRelations["order"]["refundRequest"],
): RefundRequestItem | null {
  if (!refundRequest) return null

  return {
    id: refundRequest.id,
    refundNo: refundRequest.refundNo,
    status: refundRequest.status,
    reason: refundRequest.reason,
    note: refundRequest.note,
    createdAt: refundRequest.createdAt.toISOString(),
    processedAt: refundRequest.processedAt?.toISOString() ?? null,
  }
}

export function mapOrderPayment(payment: OrderWithRelations["payments"][number]): OrderPaymentItem {
  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    channel: payment.channel,
    status: payment.status,
    amountCents: payment.amountCents,
    tradeNo: payment.tradeNo,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    callbackAt: payment.callbackAt?.toISOString() ?? null,
  }
}

export function mapOrder(order: OrderWithRelations): OrderItem {
  return {
    id: order.id,
    orderNo: order.orderNo,
    productId: order.productId,
    skuId: order.skuId,
    productName: order.productNameSnapshot ?? order.product?.name ?? null,
    skuName: order.skuNameSnapshot ?? order.sku?.name ?? null,
    productType: order.product?.type ?? null,
    amountCents: order.amountCents,
    currency: order.currency,
    validDays: order.validDaysSnapshot ?? order.sku?.validDays ?? order.product?.validDays ?? null,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    closedAt: order.closedAt?.toISOString() ?? null,
    closedReason: order.closedReason ?? null,
    refundRequestedAt: order.refundRequestedAt?.toISOString() ?? null,
    refundProcessedAt: order.refundProcessedAt?.toISOString() ?? null,
    payments: order.payments.map(mapOrderPayment),
    refundRequest: mapRefundRequest(order.refundRequest),
  }
}

export function mapPayment(payment: PaymentWithRelations): PaymentItem {
  return {
    id: payment.id,
    paymentNo: payment.paymentNo,
    orderId: payment.orderId,
    orderNo: payment.order.orderNo,
    channel: payment.channel,
    status: payment.status,
    amountCents: payment.amountCents,
    tradeNo: payment.tradeNo,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
    callbackAt: payment.callbackAt?.toISOString() ?? null,
    order: mapOrder(payment.order),
  }
}
