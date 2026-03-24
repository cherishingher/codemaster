import { withAuth } from "@/lib/authz"
import { handleModerateDiscussionComment } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(
  async (req, { params }, user) => handleModerateDiscussionComment(req, params.id, user),
  { roles: ["admin", "moderator"] },
)
