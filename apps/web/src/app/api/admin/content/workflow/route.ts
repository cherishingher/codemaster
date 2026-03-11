import { withAuth } from "@/lib/authz"
import { handleTransitionCmsStatus } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req, _ctx, user) => handleTransitionCmsStatus(req, user), { roles: "admin" })
