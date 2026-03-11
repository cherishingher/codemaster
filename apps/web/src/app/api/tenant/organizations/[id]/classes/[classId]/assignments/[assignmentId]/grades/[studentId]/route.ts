import { withAuth } from "@/lib/authz"
import { handleUpdateTenantAssignmentGrade } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export const PATCH = withAuth(async (req, { params }, user) =>
  handleUpdateTenantAssignmentGrade(
    req,
    user,
    params.id,
    params.classId,
    params.assignmentId,
    params.studentId,
  ),
)
