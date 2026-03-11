import { withAuth } from "@/lib/authz"
import {
  handleCreateTenantOrganization,
  handleListViewerOrganizations,
} from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, _ctx, user) => handleListViewerOrganizations(user))
export const POST = withAuth(async (req, _ctx, user) => handleCreateTenantOrganization(req, user), {
  roles: "admin",
})
