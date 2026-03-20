import { withAuth } from "@/lib/authz"
import { handleAuditDiscussionComment } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(
  async (req, { params }, user) => handleAuditDiscussionComment(req, params.id, user),
  { roles: ["admin", "moderator"] },
)
