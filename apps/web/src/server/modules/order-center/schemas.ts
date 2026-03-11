import { z } from "zod"

export const OrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const CreateOrderSchema = z
  .object({
    amountCents: z.number().int().min(1).max(10_000_000).optional(),
    productId: z.string().trim().min(1).max(64).optional(),
    skuId: z.string().trim().min(1).max(64).optional(),
    productType: z.string().trim().min(1).max(64).optional(),
  })
  .refine((input) => Boolean(input.amountCents || input.productId || input.skuId || input.productType), {
    message: "请提供商品、SKU 或订单金额",
    path: ["productId"],
  })

export const CreatePaymentSchema = z.object({
  orderId: z.string().trim().min(1).max(64),
  channel: z.enum(["MOCK"]).default("MOCK"),
})

export const PaymentCallbackSchema = z.object({
  paymentNo: z.string().trim().min(1).max(64),
  status: z.enum(["SUCCEEDED", "FAILED"]),
  tradeNo: z.string().trim().min(1).max(128).optional(),
  failureReason: z.string().trim().min(1).max(500).optional(),
  payload: z.record(z.unknown()).nullable().optional(),
})

export const PayOrderSchema = z.object({
  channel: z.enum(["MOCK"]).default("MOCK"),
})

export const RefundRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
})

export type OrderListQuery = z.infer<typeof OrderListQuerySchema>
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type PaymentCallbackInput = z.infer<typeof PaymentCallbackSchema>
export type PayOrderInput = z.infer<typeof PayOrderSchema>
export type RefundRequestInput = z.infer<typeof RefundRequestSchema>
