import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleListParentChildren } from "@/server/modules/parent-center/controller"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后查看孩子列表" }, { status: 401 })
  }

  return handleListParentChildren(user)
}
