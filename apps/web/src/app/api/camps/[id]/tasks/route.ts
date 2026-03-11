import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleGetCampTasks } from "@/server/modules/camp-center/controller"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(ctx.params)
  const user = await getAuthUser(req)
  return handleGetCampTasks(req, id, user ?? undefined)
}
