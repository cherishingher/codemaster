import { NextRequest } from "next/server"
import { getAuthUser, withAuth } from "@/lib/authz"
import {
  handleDeleteDiscussionPost,
  handleGetDiscussionPost,
  handleUpdateDiscussionPost,
} from "@/server/modules/discussion-center/controller"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getAuthUser(req)
  return handleGetDiscussionPost(id, user)
}

export const PATCH = withAuth(async (req, { params }, user) => {
  return handleUpdateDiscussionPost(req, params.id, user)
})

export const DELETE = withAuth(async (_req, { params }, user) => {
  return handleDeleteDiscussionPost(params.id, user)
})
