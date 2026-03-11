import { withAuth } from "@/lib/authz"
import { handleCreateCommunityPost } from "@/server/modules/community-center/controller"

export const POST = withAuth(async (req, _ctx, user) => handleCreateCommunityPost(req, user))
