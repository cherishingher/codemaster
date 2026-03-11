import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleGetContestReport } from "@/server/modules/contest-center/controller"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(ctx.params)
  const user = await getAuthUser(req)
  return handleGetContestReport(id, user ?? undefined)
}
