import { withAuth } from "@/lib/authz"
import { handleJoinStudyGroup } from "@/server/modules/community-center/controller"

export const POST = withAuth(async (_req, { params }, user) => handleJoinStudyGroup(params.id, user))
