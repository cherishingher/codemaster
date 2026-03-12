import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { createLogger } from "@/lib/logger"
import { recordDurationMetric, recordHttpMetric } from "@/lib/ops-metrics"
import { getPersonalizedLearningAnalytics } from "@/server/modules/learning-analytics-center/service"

const logger = createLogger("reports-learning-personalized")

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const user = await getAuthUser(req)

  if (!user) {
    recordHttpMetric("/api/reports/learning/personalized", 401)
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后查看个性化学习分析",
      },
      { status: 401 },
    )
  }

  try {
    const data = await getPersonalizedLearningAnalytics(user)
    const durationMs = Date.now() - startedAt
    recordHttpMetric("/api/reports/learning/personalized", 200)
    recordDurationMetric("reports.learning.personalized", durationMs)
    logger.info("request_succeeded", {
      userId: user.id,
      durationMs,
    })
    return NextResponse.json({ data })
  } catch (error) {
    recordHttpMetric("/api/reports/learning/personalized", 500)
    logger.error("request_failed", {
      userId: user.id,
      durationMs: Date.now() - startedAt,
      error,
    })
    throw error
  }
}
