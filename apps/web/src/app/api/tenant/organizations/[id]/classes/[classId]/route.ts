import { withAuth } from "@/lib/authz"
import { handleGetTenantClass } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) => handleGetTenantClass(user, params.id, params.classId))
