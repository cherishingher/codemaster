import { withAuth } from "@/lib/authz"
import { handleGetTenantClassStats } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) => handleGetTenantClassStats(user, params.id, params.classId))
