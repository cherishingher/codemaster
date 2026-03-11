import { withAuth } from "@/lib/authz"
import {
  handleCreateOrganization,
  handleListOrganizations,
} from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleListOrganizations(), { roles: "admin" })
export const POST = withAuth(async (req) => handleCreateOrganization(req), { roles: "admin" })
