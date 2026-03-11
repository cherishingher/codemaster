import { withAuth } from "@/lib/authz"
import { handleGetPayment } from "@/server/modules/order-center/payment.controller"

export const GET = withAuth(async (_req, { params }, user) => {
  return handleGetPayment(params.paymentNo, user)
})
