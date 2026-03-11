import { timingSafeEqual } from "node:crypto"
import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handlePaymentCallbackRequest } from "@/server/modules/order-center/payment.controller"

function hasValidCallbackSecret(req: NextRequest) {
  const configured = process.env.PAYMENT_CALLBACK_SECRET
  if (!configured) return false

  const provided = req.headers.get("x-payment-callback-secret")
  if (!provided) return false

  const expectedBuffer = Buffer.from(configured)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) return false

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  const trusted = hasValidCallbackSecret(req)

  if (!trusted && !user) {
    return Response.json({ error: "unauthorized", message: "未授权的支付回调请求" }, { status: 401 })
  }

  const decoratedReq = req as NextRequest & {
    callbackTrusted?: boolean
    callbackUser?: Awaited<ReturnType<typeof getAuthUser>>
  }
  decoratedReq.callbackTrusted = trusted
  decoratedReq.callbackUser = user

  return handlePaymentCallbackRequest(decoratedReq)
}
