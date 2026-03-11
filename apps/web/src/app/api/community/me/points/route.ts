import { withAuth } from "@/lib/authz"
import { handleGetMyPoints } from "@/server/modules/community-center/controller"

export const GET = withAuth(async (_req, _ctx, user) => handleGetMyPoints(user))
