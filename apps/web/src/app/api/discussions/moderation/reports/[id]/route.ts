import { withAuth } from "@/lib/authz"
import { handleResolveDiscussionReport } from "@/server/modules/discussion-center/controller"

export const PATCH = withAuth(
  async (req, { params }, user) => handleResolveDiscussionReport(req, params.id, user),
  { roles: ["admin", "moderator"] },
)
