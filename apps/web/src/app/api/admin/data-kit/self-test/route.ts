import { withAuth } from "@/lib/authz"
import { handleRunDataKitSelfTest } from "@/server/modules/data-kit-admin/controller"

export const runtime = "nodejs"

export const POST = withAuth(async () => handleRunDataKitSelfTest(), { roles: "admin" })
