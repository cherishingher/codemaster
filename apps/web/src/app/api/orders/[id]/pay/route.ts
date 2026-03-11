import { withAuth } from "@/lib/authz";
import { handleQuickMockPay } from "@/server/modules/order-center/payment.controller"

export const POST = withAuth(async (req, ctx, user) => {
  return handleQuickMockPay(req, ctx.params.id, user)
});
