import { withAuth } from "@/lib/authz"
import { handleReplaceTeachingGroupMembers } from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const PUT = withAuth(async (req, { params }) => handleReplaceTeachingGroupMembers(req, params.id), {
  roles: "admin",
})
