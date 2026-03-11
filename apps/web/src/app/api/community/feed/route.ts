import { NextRequest } from "next/server"
import { handleListCommunityFeed } from "@/server/modules/community-center/controller"

export async function GET(req: NextRequest) {
  return handleListCommunityFeed(req)
}
