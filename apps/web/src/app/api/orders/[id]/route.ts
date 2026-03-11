import { withAuth } from "@/lib/authz"
import { handleGetOrder } from "@/server/modules/order-center/order.controller"

export const GET = withAuth(async (_req, { params }, user) => {
  return handleGetOrder(params.id, user)
})
