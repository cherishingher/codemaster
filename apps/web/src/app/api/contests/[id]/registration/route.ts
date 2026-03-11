import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleCreateContestRegistration, handleGetContestRegistration } from "@/server/modules/contest-center/controller"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后查看报名状态" }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)
  return handleGetContestRegistration(id, user)
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后报名" }, { status: 401 })
  }

  const { id } = await Promise.resolve(ctx.params)
  return handleCreateContestRegistration(id, user)
}
