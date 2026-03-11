import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { handleGetCommunityPost } from "@/server/modules/community-center/controller"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getAuthUser(req)
  return handleGetCommunityPost(id, user)
}
