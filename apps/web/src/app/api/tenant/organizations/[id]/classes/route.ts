import { withAuth } from "@/lib/authz"
import {
  handleCreateTenantClass,
  handleListTenantClasses,
} from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) => handleListTenantClasses(user, params.id))
export const POST = withAuth(async (req, { params }, user) => handleCreateTenantClass(req, user, params.id))
