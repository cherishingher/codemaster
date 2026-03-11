import { withAuth } from "@/lib/authz"
import { handleCreateTeachingGroupAssignment } from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(
  async (req, { params }, user) => handleCreateTeachingGroupAssignment(req, params.id, user.id),
  { roles: "admin" },
)
