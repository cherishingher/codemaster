import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { DEFAULT_VIDEO_MEMBERSHIP, VIDEO_MEMBERSHIP_TYPE } from "@/lib/learn";

function parseIntParam(value: string | null, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

const CreateOrderSchema = z.object({
  amountCents: z.number().int().min(1).max(10_000_000).optional(),
  productId: z.string().min(1).max(64).optional(),
  productType: z.string().min(1).max(64).optional(),
});

async function resolveOrderProduct(input: z.infer<typeof CreateOrderSchema>) {
  if (input.productId) {
    return db.product.findUnique({ where: { id: input.productId } });
  }

  if (!input.productType) {
    return null;
  }

  const existing = await db.product.findFirst({
    where: { type: input.productType },
    orderBy: { priceCents: "asc" },
  });

  if (existing) {
    return existing;
  }

  if (input.productType !== VIDEO_MEMBERSHIP_TYPE) {
    return null;
  }

  return db.product.create({
    data: {
      name: DEFAULT_VIDEO_MEMBERSHIP.name,
      priceCents: DEFAULT_VIDEO_MEMBERSHIP.priceCents,
      type: DEFAULT_VIDEO_MEMBERSHIP.type,
      validDays: DEFAULT_VIDEO_MEMBERSHIP.validDays,
    },
  });
}

export const GET = withAuth(async (req, _ctx, user) => {
  const { searchParams } = new URL(req.url);
  const page = parseIntParam(searchParams.get("page"), 1);
  const limit = parseIntParam(searchParams.get("limit"), 20, 100);

  const [total, rows] = await Promise.all([
    db.order.count({
      where: { userId: user.id },
    }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: true,
      },
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return NextResponse.json({
    data: rows.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name ?? null,
      productType: item.product?.type ?? null,
      amountCents: item.amountCents,
      status: item.status,
      createdAt: item.createdAt,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  });
});

export const POST = withAuth(async (req, _ctx, user) => {
  const payload = CreateOrderSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload", message: "订单金额不合法" }, { status: 400 });
  }

  const product = await resolveOrderProduct(payload.data);
  const amountCents = product?.priceCents ?? payload.data.amountCents ?? null;

  if (!amountCents) {
    return NextResponse.json(
      { error: "invalid_payload", message: "请提供订单金额或商品信息" },
      { status: 400 }
    );
  }

  if ((payload.data.productId || payload.data.productType) && !product) {
    return NextResponse.json({ error: "product_not_found", message: "商品不存在" }, { status: 404 });
  }

  const created = await db.order.create({
    data: {
      userId: user.id,
      productId: product?.id,
      amountCents,
      status: "created",
    },
    include: {
      product: true,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: created.id,
        productId: created.productId,
        productName: created.product?.name ?? null,
        productType: created.product?.type ?? null,
        amountCents: created.amountCents,
        status: created.status,
        createdAt: created.createdAt,
      },
    },
    { status: 201 }
  );
});
