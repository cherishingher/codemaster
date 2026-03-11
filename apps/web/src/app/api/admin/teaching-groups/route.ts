import { withAuth } from "@/lib/authz"
import {
  handleCreateTeachingGroup,
  handleListTeachingGroups,
} from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleListTeachingGroups(), { roles: "admin" })
export const POST = withAuth(async (req) => handleCreateTeachingGroup(req), { roles: "admin" })
