import { withAuth } from "@/lib/authz"
import { handleModerateDiscussionPost } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(
  async (req, { params }, user) => handleModerateDiscussionPost(req, params.id, user),
  { roles: ["admin", "moderator"] },
)
