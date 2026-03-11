import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { TrainingPathIdParamSchema } from "@/server/modules/training-path-center/schemas"
import { syncTrainingPathProgress } from "@/server/modules/training-path-center/service"

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后同步路径进度",
      },
      { status: 401 },
    )
  }

  const { id } = TrainingPathIdParamSchema.parse(await Promise.resolve(ctx.params))
  const detail = await syncTrainingPathProgress(id, user)

  if (!detail) {
    return NextResponse.json({ error: "not_found", message: "训练路径不存在" }, { status: 404 })
  }

  return NextResponse.json({
    data: detail,
  })
}
