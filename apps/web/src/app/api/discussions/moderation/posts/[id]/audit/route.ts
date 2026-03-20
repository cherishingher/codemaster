import { withAuth } from "@/lib/authz"
import { handleAuditDiscussionPost } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(
  async (req, { params }, user) => handleAuditDiscussionPost(req, params.id, user),
  { roles: ["admin", "moderator"] },
)
