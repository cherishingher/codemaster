import { withAuth } from "@/lib/authz"
import { handleMarkDiscussionSolved } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (req, { params }, user) => {
  return handleMarkDiscussionSolved(req, params.id, user)
})
