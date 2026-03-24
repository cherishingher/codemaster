import { withAuth } from "@/lib/authz"
import { handleListDiscussionModerationComments } from "@/server/modules/discussion-center/controller"

export const GET = withAuth(
  async (req, _ctx, user) => handleListDiscussionModerationComments(req, user),
  { roles: ["admin", "moderator"] },
)
