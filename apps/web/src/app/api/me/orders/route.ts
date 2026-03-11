import { withAuth } from "@/lib/authz"
import { handleListOrders } from "@/server/modules/order-center/order.controller"

export const GET = withAuth(async (req, _ctx, user) => {
  return handleListOrders(req, user)
})
