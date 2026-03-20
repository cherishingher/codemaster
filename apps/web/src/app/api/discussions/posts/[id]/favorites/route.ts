import { withAuth } from "@/lib/authz"
import {
  handleFavoriteDiscussionPost,
  handleUnfavoriteDiscussionPost,
} from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (_req, { params }, user) => {
  return handleFavoriteDiscussionPost(params.id, user)
})

export const DELETE = withAuth(async (_req, { params }, user) => {
  return handleUnfavoriteDiscussionPost(params.id, user)
})
