import { withAuth } from "@/lib/authz"
import { handleValidateWithDataKit } from "@/server/modules/data-kit-admin/controller"

export const runtime = "nodejs"

export const POST = withAuth(async (req) => handleValidateWithDataKit(req), { roles: "admin" })
