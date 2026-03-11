import { withAuth } from "@/lib/authz"
import { handleCreateTenantTeacher } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req, { params }, user) => handleCreateTenantTeacher(req, user, params.id))
