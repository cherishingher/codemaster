import { withAuth } from "@/lib/authz"
import { handleGetDataKitOverview } from "@/server/modules/data-kit-admin/controller"

export const runtime = "nodejs"

export const GET = withAuth(async () => handleGetDataKitOverview(), { roles: "admin" })
