import { withAuth } from "@/lib/authz"
import { handleGetMembershipMe } from "@/server/modules/membership/controller"

export const GET = withAuth(async (_req, _ctx, user) => {
  return handleGetMembershipMe(user)
})
