import { withAuth } from "@/lib/authz"
import { handleGetCmsOverview } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleGetCmsOverview(), { roles: "admin" })
