import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleListRewards } from "@/server/modules/community-center/controller"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  return handleListRewards(user)
}
