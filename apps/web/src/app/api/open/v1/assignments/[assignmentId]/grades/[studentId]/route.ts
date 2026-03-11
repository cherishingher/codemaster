import { NextRequest } from "next/server"
import { handleOpenUpdateTenantAssignmentGrade } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string; studentId: string }> },
) {
  const resolved = await params
  return handleOpenUpdateTenantAssignmentGrade(req, resolved.assignmentId, resolved.studentId)
}
