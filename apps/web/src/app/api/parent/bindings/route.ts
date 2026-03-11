import { withAuth } from "@/lib/authz"
import { handleCreateParentBinding } from "@/server/modules/parent-center/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req, _ctx, user) => handleCreateParentBinding(req, user))
