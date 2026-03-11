import { NextRequest } from "next/server"
import { getAuthUser, withAuth } from "@/lib/authz"
import { handleCreateStudyGroup, handleListStudyGroups } from "@/server/modules/community-center/controller"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  return handleListStudyGroups(req, user)
}

export const POST = withAuth(async (req, _ctx, user) => handleCreateStudyGroup(req, user))
