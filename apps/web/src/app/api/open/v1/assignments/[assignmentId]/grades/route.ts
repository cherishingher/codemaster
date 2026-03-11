import { NextRequest } from "next/server"
import { handleOpenGetTenantAssignmentGrades } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const resolved = await params
  return handleOpenGetTenantAssignmentGrades(req, resolved.assignmentId)
}
