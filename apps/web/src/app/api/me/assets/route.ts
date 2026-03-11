import { withAuth } from "@/lib/authz"
import { handleGetMyAssets } from "@/server/modules/product-center/controller"

export const GET = withAuth(async (_req, _ctx, user) => {
  return handleGetMyAssets(user)
})
