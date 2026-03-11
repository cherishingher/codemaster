import { withAuth } from "@/lib/authz"
import { handleSyncTenantAssignmentGrades } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (_req, { params }, user) =>
  handleSyncTenantAssignmentGrades(user, params.id, params.classId, params.assignmentId),
)
