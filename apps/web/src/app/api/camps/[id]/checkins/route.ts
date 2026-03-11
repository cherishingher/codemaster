import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleCreateCampCheckin } from "@/server/modules/camp-center/controller"

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后打卡" }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)
  return handleCreateCampCheckin(req, id, user)
}
