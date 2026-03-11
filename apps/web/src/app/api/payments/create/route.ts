import { withAuth } from "@/lib/authz"
import { handleCreatePayment } from "@/server/modules/order-center/payment.controller"

export const POST = withAuth(async (req, _ctx, user) => {
  return handleCreatePayment(req, user)
})
