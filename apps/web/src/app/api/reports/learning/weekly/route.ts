import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { getLearningWeekly } from "@/server/modules/learning-report-center/service"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)

  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后查看学习报告",
      },
      { status: 401 },
    )
  }

  const data = await getLearningWeekly(user)
  return NextResponse.json({ data })
}
