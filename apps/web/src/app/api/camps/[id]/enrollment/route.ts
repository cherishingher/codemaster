import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleGetCampEnrollment } from "@/server/modules/camp-center/controller"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后查看报名状态" }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)
  return handleGetCampEnrollment(id, user)
}
