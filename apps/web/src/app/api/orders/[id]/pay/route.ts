import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const PaySchema = z.object({
  channel: z.enum(["wechat", "alipay", "manual"]),
  transactionId: z.string().optional(),
});

export const POST = withAuth(async (req, { params }, user) => {
  const { id } = params;
  const data = PaySchema.parse(await req.json());

  const order = await db.order.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (order.userId !== user.id && !user.roles.includes("admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId: order.id,
        channel: data.channel,
        status: "paid",
        paidAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "paid" },
    });

    if (order.product) {
      const expiresAt = order.product.validDays
        ? new Date(Date.now() + order.product.validDays * 86400000)
        : null;

      await tx.entitlement.upsert({
        where: {
          userId_productId: { userId: order.userId, productId: order.product.id },
        },
        create: {
          userId: order.userId,
          productId: order.product.id,
          expiresAt,
        },
        update: {
          expiresAt,
          grantedAt: new Date(),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, message: "支付成功，权益已发放" });
});
