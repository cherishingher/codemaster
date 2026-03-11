import { withAuth } from "@/lib/authz"
import { handleRemoveParentBinding } from "@/server/modules/parent-center/controller"

export const dynamic = "force-dynamic"

export const DELETE = withAuth(async (_req, { params }, user) =>
  handleRemoveParentBinding(params.id, user),
)
