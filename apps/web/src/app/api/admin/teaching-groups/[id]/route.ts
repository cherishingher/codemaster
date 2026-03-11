import { withAuth } from "@/lib/authz"
import {
  handleGetTeachingGroupDetail,
  handleUpdateTeachingGroup,
} from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }) => handleGetTeachingGroupDetail(params.id), {
  roles: "admin",
})

export const PATCH = withAuth(async (req, { params }) => handleUpdateTeachingGroup(req, params.id), {
  roles: "admin",
})
