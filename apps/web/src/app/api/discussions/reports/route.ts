import { withAuth } from "@/lib/authz"
import { handleCreateDiscussionReport } from "@/server/modules/discussion-center/controller"

export const POST = withAuth(async (req, _ctx, user) => handleCreateDiscussionReport(req, user))
