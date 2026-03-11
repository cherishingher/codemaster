import { NextRequest } from "next/server"
import {
  handleOpenCreateTenantClassAssignment,
  handleOpenListTenantClassAssignments,
} from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params
  return handleOpenListTenantClassAssignments(req, resolved.id)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params
  return handleOpenCreateTenantClassAssignment(req, resolved.id)
}
