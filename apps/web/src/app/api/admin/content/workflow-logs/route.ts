import { withAuth } from "@/lib/authz"
import { handleListWorkflowLogs } from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (req) => handleListWorkflowLogs(req), { roles: "admin" })
