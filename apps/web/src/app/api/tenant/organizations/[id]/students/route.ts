import { withAuth } from "@/lib/authz"
import { handleCreateTenantStudent } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (req, { params }, user) => handleCreateTenantStudent(req, user, params.id))
