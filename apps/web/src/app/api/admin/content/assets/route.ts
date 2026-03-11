import { withAuth } from "@/lib/authz"
import {
  handleCreateCmsAsset,
  handleListCmsAssets,
} from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req) => handleListCmsAssets(req), { roles: "admin" })
export const POST = withAuth(async (req, _ctx, user) => handleCreateCmsAsset(req, user), { roles: "admin" })
