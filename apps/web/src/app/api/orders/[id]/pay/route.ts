import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const PayOrderSchema = z.object({
  channel: z.string().min(1).max(64).optional(),
});

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export const POST = withAuth(async (req, ctx, user) => {
  const existingOrder = await db.order.findUnique({
    where: { id: ctx.params.id },
    include: {
      product: true,
    },
  });

  if (!existingOrder || existingOrder.userId !== user.id) {
    return NextResponse.json({ error: "not_found", message: "订单不存在" }, { status: 404 });
  }

  let rawPayload: unknown = {};
  try {
    rawPayload = await req.json();
  } catch {
    rawPayload = {};
  }

  const parsed = PayOrderSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: "支付参数不合法" }, { status: 400 });
  }

  const channel = parsed.data.channel?.trim() || "mock-local";
  const paidAt = new Date();
  const wasAlreadyPaid = existingOrder.status === "paid";

  const order =
    wasAlreadyPaid
      ? existingOrder
      : await db.order.update({
          where: { id: existingOrder.id },
          data: { status: "paid" },
          include: {
            product: true,
          },
        });

  const existingPayment = await db.payment.findFirst({
    where: { orderId: existingOrder.id },
  });

  if (existingPayment) {
    await db.payment.update({
      where: { id: existingPayment.id },
      data: {
        channel,
        status: "paid",
        paidAt,
      },
    });
  } else {
    await db.payment.create({
      data: {
        orderId: existingOrder.id,
        channel,
        status: "paid",
        paidAt,
      },
    });
  }

  if (!wasAlreadyPaid && order.productId && order.product) {
    const currentEntitlement = await db.entitlement.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId: order.productId,
        },
      },
    });

    const expiresAt =
      order.product.validDays && order.product.validDays > 0
        ? addDays(
            currentEntitlement?.expiresAt && currentEntitlement.expiresAt > paidAt
              ? currentEntitlement.expiresAt
              : paidAt,
            order.product.validDays,
          )
        : null;

    await db.entitlement.upsert({
      where: {
        userId_productId: {
          userId: user.id,
          productId: order.productId,
        },
      },
      update: {
        grantedAt: paidAt,
        expiresAt,
      },
      create: {
        userId: user.id,
        productId: order.productId,
        grantedAt: paidAt,
        expiresAt,
      },
    });
  }

  return NextResponse.json({
    data: {
      id: order.id,
      productId: order.productId,
      productName: order.product?.name ?? null,
      productType: order.product?.type ?? null,
      amountCents: order.amountCents,
      status: "paid",
      createdAt: order.createdAt,
      paidAt,
      channel,
    },
  });
});
