import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { getSolutionDetail } from "@/server/modules/solution-center/service"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(ctx.params)
  const user = await getAuthUser(req)
  const data = await getSolutionDetail(id, user ?? undefined)

  if (!data) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "题解不存在或当前不可访问",
      },
      { status: 404 },
    )
  }

  return NextResponse.json({ data })
}
