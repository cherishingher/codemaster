import { withAuth } from "@/lib/authz"
import {
  handleLikeDiscussionComment,
  handleUnlikeDiscussionComment,
} from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (_req, { params }, user) => {
  return handleLikeDiscussionComment(params.id, user)
})

export const DELETE = withAuth(async (_req, { params }, user) => {
  return handleUnlikeDiscussionComment(params.id, user)
})
