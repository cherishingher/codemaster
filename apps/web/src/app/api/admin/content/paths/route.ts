import { withAuth } from "@/lib/authz"
import {
  handleCreateCmsPath,
  handleListCmsPaths,
} from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleListCmsPaths(), { roles: "admin" })
export const POST = withAuth(async (req, _ctx, user) => handleCreateCmsPath(req, user), { roles: "admin" })
