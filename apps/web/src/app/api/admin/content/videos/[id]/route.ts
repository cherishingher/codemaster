import { withAuth } from "@/lib/authz"
import { handleUpdateCmsVideo } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const PATCH = withAuth(async (req, { params }) => handleUpdateCmsVideo(req, params.id), {
  roles: "admin",
})
