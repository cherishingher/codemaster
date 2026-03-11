import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { getLearningReport } from "@/server/modules/learning-report-center/service"

export async function GET(
  req: NextRequest,
  ctx: { params: { scope: string } | Promise<{ scope: string }> },
) {
  const { scope } = await Promise.resolve(ctx.params)
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

  const report = await getLearningReport(scope, user)

  return NextResponse.json({
    data: report,
  })
}
