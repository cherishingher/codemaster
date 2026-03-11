import { withAuth } from "@/lib/authz"
import {
  handleCreateOrder,
  handleListOrders,
} from "@/server/modules/order-center/order.controller"

export const GET = withAuth(async (req, _ctx, user) => {
  return handleListOrders(req, user)
})

export const POST = withAuth(async (req, _ctx, user) => {
  return handleCreateOrder(req, user)
})
