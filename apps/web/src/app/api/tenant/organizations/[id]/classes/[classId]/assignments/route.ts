import { withAuth } from "@/lib/authz"
import {
  handleCreateTenantClassAssignment,
  handleListTenantClassAssignments,
} from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) =>
  handleListTenantClassAssignments(user, params.id, params.classId),
)

export const POST = withAuth(async (req, { params }, user) =>
  handleCreateTenantClassAssignment(req, user, params.id, params.classId),
)
