import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleListCamps } from "@/server/modules/camp-center/controller"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  return handleListCamps(req, user ?? undefined)
}
