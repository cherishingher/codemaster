import { NextRequest } from "next/server"
import { getAuthUser, withAuth } from "@/lib/authz"
import {
  handleCreateDiscussionComment,
  handleListDiscussionComments,
} from "@/server/modules/discussion-center/controller"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getAuthUser(req)
  return handleListDiscussionComments(req, id, user)
}

export const POST = withAuth(async (req, { params }, user) => {
  return handleCreateDiscussionComment(req, params.id, user)
})
