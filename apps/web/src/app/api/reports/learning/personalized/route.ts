import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { getPersonalizedLearningAnalytics } from "@/server/modules/learning-analytics-center/service"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)

  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后查看个性化学习分析",
      },
      { status: 401 },
    )
  }

  const data = await getPersonalizedLearningAnalytics(user)
  return NextResponse.json({ data })
}
