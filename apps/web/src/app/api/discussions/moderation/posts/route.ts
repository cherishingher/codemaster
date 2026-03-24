import { withAuth } from "@/lib/authz"
import { handleListDiscussionModerationPosts } from "@/server/modules/discussion-center/controller"

export const GET = withAuth(
  async (req, _ctx, user) => handleListDiscussionModerationPosts(req, user),
  { roles: ["admin", "moderator"] },
)
