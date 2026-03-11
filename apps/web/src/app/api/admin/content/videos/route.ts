import { withAuth } from "@/lib/authz"
import { handleListCmsVideos } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleListCmsVideos(), { roles: "admin" })
