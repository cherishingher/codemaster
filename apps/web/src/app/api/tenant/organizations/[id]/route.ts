import { withAuth } from "@/lib/authz"
import { handleGetTenantOrganization } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) => handleGetTenantOrganization(user, params.id))
