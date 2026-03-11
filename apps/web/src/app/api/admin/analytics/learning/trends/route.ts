import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { getPlatformLearningAnalyticsTrends } from "@/server/modules/learning-analytics-center/service"

export const GET = withAuth(
  async () => {
    const data = await getPlatformLearningAnalyticsTrends()
    return NextResponse.json({ data })
  },
  { roles: "admin" },
)
