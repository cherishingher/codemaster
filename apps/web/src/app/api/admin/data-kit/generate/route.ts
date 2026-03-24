import { withAuth } from "@/lib/authz"
import { handleGenerateWithDataKit } from "@/server/modules/data-kit-admin/controller"

export const runtime = "nodejs"

export const POST = withAuth(async (req) => handleGenerateWithDataKit(req), { roles: "admin" })
