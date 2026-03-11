import { withAuth } from "@/lib/authz"
import { handleRedeemReward } from "@/server/modules/community-center/controller"

export const POST = withAuth(async (_req, { params }, user) => handleRedeemReward(params.id, user))
