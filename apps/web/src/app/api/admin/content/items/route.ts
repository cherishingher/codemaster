import { withAuth } from "@/lib/authz"
import { handleGetContentStudioOverview } from "@/server/modules/content-studio/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleGetContentStudioOverview(), { roles: "admin" })
