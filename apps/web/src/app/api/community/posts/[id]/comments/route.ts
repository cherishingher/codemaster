import { withAuth } from "@/lib/authz"
import { handleCreateCommunityComment } from "@/server/modules/community-center/controller"

export const POST = withAuth(async (req, { params }, user) => handleCreateCommunityComment(req, params.id, user))
