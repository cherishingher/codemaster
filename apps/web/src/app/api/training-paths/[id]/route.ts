import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { TrainingPathIdParamSchema } from "@/server/modules/training-path-center/schemas"
import { getTrainingPathDetail } from "@/server/modules/training-path-center/service"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = TrainingPathIdParamSchema.parse(await Promise.resolve(ctx.params))
  const user = await getAuthUser(req)

  const detail = await getTrainingPathDetail(id, user ?? undefined)

  if (!detail) {
    return NextResponse.json({ error: "not_found", message: "训练路径不存在" }, { status: 404 })
  }

  return NextResponse.json({
    data: detail,
  })
}
