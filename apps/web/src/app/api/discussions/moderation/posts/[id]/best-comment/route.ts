import { withAuth } from "@/lib/authz"
import { handleSetDiscussionBestComment } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (req, { params }, user) => {
  return handleSetDiscussionBestComment(req, params.id, user)
})
