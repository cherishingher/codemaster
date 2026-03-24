import { withAuth } from "@/lib/authz"
import {
  handleLikeDiscussionPost,
  handleUnlikeDiscussionPost,
} from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (_req, { params }, user) => {
  return handleLikeDiscussionPost(params.id, user)
})

export const DELETE = withAuth(async (_req, { params }, user) => {
  return handleUnlikeDiscussionPost(params.id, user)
})
