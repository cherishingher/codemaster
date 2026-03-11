import { withAuth } from "@/lib/authz"
import { handleRefundRequest } from "@/server/modules/order-center/order.controller"

export const POST = withAuth(async (req, { params }, user) => {
  return handleRefundRequest(req, params.id, user)
})
