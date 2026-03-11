import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { getPlatformLearningAnalyticsOverview } from "@/server/modules/learning-analytics-center/service"

export const GET = withAuth(
  async () => {
    const data = await getPlatformLearningAnalyticsOverview()
    return NextResponse.json({ data })
  },
  { roles: "admin" },
)
