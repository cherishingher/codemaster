import { withAuth } from "@/lib/authz"
import { handleImportTeachingGroupMembers } from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req, { params }) => handleImportTeachingGroupMembers(req, params.id), {
  roles: "admin",
})
