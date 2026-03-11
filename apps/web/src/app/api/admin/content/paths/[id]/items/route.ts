import { withAuth } from "@/lib/authz"
import { handleReplaceCmsPathItems } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const PUT = withAuth(async (req, { params }) => handleReplaceCmsPathItems(req, params.id), {
  roles: "admin",
})
