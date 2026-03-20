import { withAuth } from "@/lib/authz"
import { handleListDiscussionModerationReports } from "@/server/modules/discussion-center/controller"

export const GET = withAuth(
  async (req, _ctx, user) => handleListDiscussionModerationReports(req, user),
  { roles: ["admin", "moderator"] },
)
