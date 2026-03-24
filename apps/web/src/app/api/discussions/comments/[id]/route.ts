import { withAuth } from "@/lib/authz"
import {
  handleDeleteDiscussionComment,
  handleUpdateDiscussionComment,
} from "@/server/modules/discussion-center/controller"

export const PATCH = withAuth(async (req, { params }, user) => {
  return handleUpdateDiscussionComment(req, params.id, user)
})

export const DELETE = withAuth(async (_req, { params }, user) => {
  return handleDeleteDiscussionComment(params.id, user)
})
