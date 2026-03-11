import { withAuth } from "@/lib/authz"
import { handleGetOrganizationDetail, handleUpdateOrganization } from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }) => handleGetOrganizationDetail(params.id), {
  roles: "admin",
})

export const PATCH = withAuth(async (req, { params }) => handleUpdateOrganization(req, params.id), {
  roles: "admin",
})
