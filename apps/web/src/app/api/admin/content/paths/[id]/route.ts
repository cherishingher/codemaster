import { withAuth } from "@/lib/authz"
import {
  handleGetCmsPathDetail,
  handleUpdateCmsPath,
} from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }) => handleGetCmsPathDetail(params.id), { roles: "admin" })
export const PATCH = withAuth(async (req, { params }) => handleUpdateCmsPath(req, params.id), {
  roles: "admin",
})
