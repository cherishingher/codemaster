import { withAuth } from "@/lib/authz"
import { handleGetTeachingGroupStats } from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }) => handleGetTeachingGroupStats(params.id), {
  roles: "admin",
})
