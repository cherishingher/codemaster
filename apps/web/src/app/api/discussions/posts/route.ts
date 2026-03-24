import { NextRequest } from "next/server"
import { withAuth } from "@/lib/authz"
import {
  handleCreateDiscussionPost,
  handleListDiscussionPosts,
} from "@/server/modules/discussion-center/controller"

export async function GET(req: NextRequest) {
  return handleListDiscussionPosts(req)
}

export const POST = withAuth(async (req, _ctx, user) => handleCreateDiscussionPost(req, user))
