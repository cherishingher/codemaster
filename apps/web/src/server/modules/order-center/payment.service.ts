import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createLogger } from "@/lib/logger"
import { recordPaymentCallbackMetric } from "@/lib/ops-metrics"
import type {
  CreatePaymentResponse,
  PayOrderResponse,
  PaymentCallbackResponse,
  PaymentDetailResponse,
} from "@/lib/orders"
import { releaseCampEnrollmentForOrder } from "@/server/modules/camp-center/enrollment.service"
import { releaseContestRegistrationForOrder } from "@/server/modules/contest-center/registration.service"
import { grantEntitlementForPayment } from "@/server/modules/order-center/entitlement-grant.service"
import type {
  CreatePaymentInput,
  PaymentCallbackInput,
  PayOrderInput,
} from "@/server/modules/order-center/schemas"
import {
  OrderCenterError,
  buildBusinessNo,
  mapPayment,
  orderArgs,
  paymentArgs,
} from "@/server/modules/order-center/shared"

type PaymentCallbackActor = {
  userId?: string | null
  roles?: string[]
  trusted?: boolean
}

const logger = createLogger("payment")

async function loadPaymentByNo(tx: Prisma.TransactionClient | typeof db, paymentNo: string) {
  return tx.payment.findUnique({
    where: { paymentNo },
    ...paymentArgs,
  })
}

async function finalizeSuccessfulPayment(
  tx: Prisma.TransactionClient,
  paymentNo: string,
  callbackAt: Date,
  input: PaymentCallbackInput,
) {
  const payment = await loadPaymentByNo(tx, paymentNo)

  if (!payment) {
    throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
  }

  const callbackPayload = input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.JsonNull
  const tradeNo = input.tradeNo ?? payment.tradeNo ?? buildBusinessNo("PAY")
  const paidAt = payment.paidAt ?? callbackAt

  if (payment.status === "SUCCEEDED") {
    recordPaymentCallbackMetric("replayed")
    logger.info("callback_replayed", {
      paymentNo,
      orderId: payment.orderId,
      channel: payment.channel,
    })
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        callbackAt,
        callbackPayload,
        tradeNo,
        failureReason: null,
        paidAt,
      },
    })
  } else {
    await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: ["CREATED", "PENDING", "FAILED"],
        },
      },
      data: {
        status: "SUCCEEDED",
        paidAt,
        callbackAt,
        tradeNo,
        callbackPayload,
        failureReason: null,
      },
    })
  }

  await tx.order.updateMany({
    where: {
      id: payment.orderId,
      status: {
        in: ["CREATED", "PENDING", "CLOSED"],
      },
    },
    data: {
      status: "PAID",
      paidAt,
      closedAt: null,
      closedReason: null,
    },
  })

  await grantEntitlementForPayment(tx, payment.id)

  await tx.order.updateMany({
    where: {
      id: payment.orderId,
      status: {
        in: ["CREATED", "PENDING", "PAID", "CLOSED"],
      },
    },
    data: {
      status: "COMPLETED",
      paidAt,
      closedAt: null,
      closedReason: null,
    },
  })

  const refreshed = await loadPaymentByNo(tx, paymentNo)
  if (!refreshed) {
    throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
  }

  return refreshed
}

export async function getUserPaymentDetail(
  userId: string,
  paymentNo: string,
): Promise<PaymentDetailResponse> {
  const payment = await loadPaymentByNo(db, paymentNo)

  if (!payment || payment.order.userId !== userId) {
    throw new OrderCenterError("not_found", "支付单不存在", 404)
  }

  return {
    data: mapPayment(payment),
  }
}

export async function createPaymentForOrder(
  userId: string,
  input: CreatePaymentInput,
): Promise<CreatePaymentResponse> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      ...orderArgs,
    })

    if (!order || order.userId !== userId) {
      throw new OrderCenterError("not_found", "订单不存在", 404)
    }

    if (
      order.status === "PAID" ||
      order.status === "COMPLETED" ||
      order.status === "REFUNDING" ||
      order.status === "REFUNDED"
    ) {
      throw new OrderCenterError("order_not_payable", "当前订单状态不允许创建支付单", 409)
    }

    if (order.status === "CLOSED") {
      throw new OrderCenterError("order_closed", "订单已关闭，请重新下单", 409)
    }

    const existing = await tx.payment.findFirst({
      where: {
        orderId: order.id,
        channel: input.channel,
        status: {
          in: ["CREATED", "PENDING"],
        },
      },
      ...paymentArgs,
      orderBy: { createdAt: "desc" },
    })

    if (existing) {
      logger.info("payment_reused", {
        orderId: order.id,
        paymentNo: existing.paymentNo,
        channel: input.channel,
        userId,
      })
      if (order.status !== "PENDING") {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PENDING" },
        })
      }

      const refreshed = await loadPaymentByNo(tx, existing.paymentNo)
      if (!refreshed) {
        throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
      }

      return {
        data: {
          ...mapPayment(refreshed),
          payUrl: `/payments/${refreshed.paymentNo}`,
        },
      }
    }

    const created = await tx.payment.create({
      data: {
        paymentNo: buildBusinessNo("PAY"),
        orderId: order.id,
        channel: input.channel,
        status: "PENDING",
        amountCents: order.amountCents,
        payload: {
          mode: "mock",
          channel: input.channel,
        },
      },
      ...paymentArgs,
    })

    logger.info("payment_created", {
      orderId: order.id,
      paymentNo: created.paymentNo,
      channel: input.channel,
      amountCents: order.amountCents,
      userId,
    })

    await tx.order.updateMany({
      where: {
        id: order.id,
        status: {
          in: ["CREATED", "PENDING"],
        },
      },
      data: {
        status: "PENDING",
      },
    })

    const refreshed = await loadPaymentByNo(tx, created.paymentNo)
    if (!refreshed) {
      throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
    }

    return {
      data: {
        ...mapPayment(refreshed),
        payUrl: `/payments/${refreshed.paymentNo}`,
      },
    }
  })
}

export async function handlePaymentCallback(
  input: PaymentCallbackInput,
  actor: PaymentCallbackActor = {},
): Promise<PaymentCallbackResponse> {
  return db.$transaction(async (tx) => {
    const payment = await loadPaymentByNo(tx, input.paymentNo)

    if (!payment) {
      throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
    }

    const isTrusted = Boolean(actor.trusted)
    const isAdmin = Boolean(actor.roles?.includes("admin"))
    if (!isTrusted) {
      if (!actor.userId) {
        logger.warn("callback_rejected", {
          paymentNo: input.paymentNo,
          reason: "missing_actor",
        })
        throw new OrderCenterError("unauthorized", "未授权的支付回调请求", 401)
      }
      if (!isAdmin && payment.order.userId !== actor.userId) {
        logger.warn("callback_rejected", {
          paymentNo: input.paymentNo,
          actorUserId: actor.userId,
          reason: "wrong_owner",
        })
        throw new OrderCenterError("forbidden", "无权处理该支付单", 403)
      }
      if (payment.channel !== "MOCK") {
        logger.warn("callback_rejected", {
          paymentNo: input.paymentNo,
          actorUserId: actor.userId,
          channel: payment.channel,
          reason: "unsupported_channel",
        })
        throw new OrderCenterError("forbidden", "当前支付通道不支持客户端回调", 403)
      }
    }

    const callbackAt = new Date()

    if (input.status === "SUCCEEDED") {
      const refreshed = await finalizeSuccessfulPayment(tx, input.paymentNo, callbackAt, input)
      recordPaymentCallbackMetric("succeeded")
      logger.info("callback_succeeded", {
        paymentNo: refreshed.paymentNo,
        orderId: refreshed.order.id,
        channel: refreshed.channel,
        trusted: isTrusted,
      })

      return {
        data: mapPayment(refreshed),
      }
    }

    if (payment.status === "SUCCEEDED") {
      const refreshed = await loadPaymentByNo(tx, input.paymentNo)
      if (!refreshed) {
        throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
      }

      recordPaymentCallbackMetric("replayed")
      logger.info("callback_duplicate_success", {
        paymentNo: refreshed.paymentNo,
        orderId: refreshed.order.id,
        channel: refreshed.channel,
        trusted: isTrusted,
      })

      return {
        data: mapPayment(refreshed),
      }
    }

    if (payment.status === "FAILED") {
      recordPaymentCallbackMetric("replayed")
      logger.info("callback_duplicate_failed", {
        paymentNo: payment.paymentNo,
        orderId: payment.orderId,
        channel: payment.channel,
      })
      return {
        data: mapPayment(payment),
      }
    }

    const transitioned = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: ["CREATED", "PENDING"],
        },
      },
      data: {
        status: "FAILED",
        callbackAt,
        callbackPayload: input.payload ? (input.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
        failureReason: input.failureReason ?? "MOCK 支付失败",
      },
    })

    const latestPayment = await loadPaymentByNo(tx, input.paymentNo)
    if (!latestPayment) {
      throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
    }

    if (transitioned.count > 0) {
      await tx.order.updateMany({
        where: {
          id: latestPayment.orderId,
          status: {
            in: ["CREATED", "PENDING"],
          },
        },
        data: {
          status: "CLOSED",
          closedAt: callbackAt,
          closedReason: input.failureReason ?? "MOCK 支付失败",
        },
      })
      await releaseCampEnrollmentForOrder(tx, latestPayment.orderId)
      await releaseContestRegistrationForOrder(tx, latestPayment.orderId)
      recordPaymentCallbackMetric("failed")
      logger.warn("callback_failed", {
        paymentNo: latestPayment.paymentNo,
        orderId: latestPayment.orderId,
        channel: latestPayment.channel,
        trusted: isTrusted,
        failureReason: input.failureReason ?? "MOCK 支付失败",
      })
    }

    const refreshed = await loadPaymentByNo(tx, input.paymentNo)
    if (!refreshed) {
      throw new OrderCenterError("payment_not_found", "支付单不存在", 404)
    }

    return {
      data: mapPayment(refreshed),
    }
  })
}

export async function quickMockPayOrder(
  userId: string,
  orderId: string,
  input: PayOrderInput,
): Promise<PayOrderResponse> {
  const created = await createPaymentForOrder(userId, {
    orderId,
    channel: input.channel,
  })

  const paid = await handlePaymentCallback({
    paymentNo: created.data.paymentNo,
    status: "SUCCEEDED",
    tradeNo: created.data.paymentNo,
    payload: {
      mode: "mock-shortcut",
    },
  }, {
    userId,
  })

  return {
    data: {
      ...paid.data.order,
      channel: paid.data.channel,
    },
  }
}
