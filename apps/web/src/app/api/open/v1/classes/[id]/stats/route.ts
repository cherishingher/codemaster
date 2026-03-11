import { NextRequest } from "next/server"
import { handleOpenGetTenantClassStats } from "@/server/modules/tenant-admin/controller"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params
  return handleOpenGetTenantClassStats(req, resolved.id)
}
