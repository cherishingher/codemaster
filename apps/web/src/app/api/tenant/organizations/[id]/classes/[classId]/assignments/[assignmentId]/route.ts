import { withAuth } from "@/lib/authz"
import { handleGetTenantAssignmentDetail } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }, user) =>
  handleGetTenantAssignmentDetail(user, params.id, params.classId, params.assignmentId),
)
