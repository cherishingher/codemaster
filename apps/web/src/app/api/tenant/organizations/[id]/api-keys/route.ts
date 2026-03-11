import { withAuth } from "@/lib/authz"
import {
  handleCreateOrganizationApiKey,
  handleListOrganizationApiKeys,
} from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) => handleListOrganizationApiKeys(user, params.id))
export const POST = withAuth(async (req, { params }, user) => handleCreateOrganizationApiKey(req, user, params.id))
