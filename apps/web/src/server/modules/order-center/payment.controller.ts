import { NextRequest, NextResponse } from "next/server"
import type { AuthUser } from "@/lib/authz"
import {
  CreatePaymentSchema,
  PayOrderSchema,
  PaymentCallbackSchema,
} from "@/server/modules/order-center/schemas"
import {
  createPaymentForOrder,
  getUserPaymentDetail,
  handlePaymentCallback,
  quickMockPayOrder,
} from "@/server/modules/order-center/payment.service"
import { mapOrderCenterError } from "@/server/modules/order-center/controller-shared"

export async function handleGetPayment(paymentNo: string, user: AuthUser) {
  try {
    const payload = await getUserPaymentDetail(user.id, paymentNo)
    return NextResponse.json(payload)
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handleCreatePayment(req: NextRequest, user: AuthUser) {
  try {
    const payload = CreatePaymentSchema.parse(await req.json())
    const created = await createPaymentForOrder(user.id, payload)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handlePaymentCallbackRequest(req: NextRequest) {
  try {
    const payload = PaymentCallbackSchema.parse(await req.json())
    const trusted = (req as NextRequest & { callbackTrusted?: boolean }).callbackTrusted === true
    const callbackUser = (req as NextRequest & { callbackUser?: AuthUser | null }).callbackUser ?? null
    const result = await handlePaymentCallback(payload, {
      trusted,
      userId: callbackUser?.id,
      roles: callbackUser?.roles,
    })
    return NextResponse.json(result)
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handleQuickMockPay(req: NextRequest, orderId: string, user: AuthUser) {
  try {
    let rawPayload: unknown = {}
    try {
      rawPayload = await req.json()
    } catch {
      rawPayload = {}
    }

    const payload = PayOrderSchema.parse(rawPayload)
    const result = await quickMockPayOrder(user.id, orderId, payload)
    return NextResponse.json(result)
  } catch (error) {
    return mapOrderCenterError(error)
  }
}
