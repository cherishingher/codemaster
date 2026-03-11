import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleListContests } from "@/server/modules/contest-center/controller"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  return handleListContests(req, user ?? undefined)
}
