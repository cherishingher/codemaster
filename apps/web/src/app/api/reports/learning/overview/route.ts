import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { createLogger } from "@/lib/logger"
import { recordDurationMetric, recordHttpMetric } from "@/lib/ops-metrics"
import { getLearningOverview } from "@/server/modules/learning-report-center/service"

const logger = createLogger("reports-learning-overview")

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const user = await getAuthUser(req)

  if (!user) {
    recordHttpMetric("/api/reports/learning/overview", 401)
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后查看学习报告",
      },
      { status: 401 },
    )
  }

  try {
    const data = await getLearningOverview(user)
    const durationMs = Date.now() - startedAt
    recordHttpMetric("/api/reports/learning/overview", 200)
    recordDurationMetric("reports.learning.overview", durationMs)
    logger.info("request_succeeded", {
      userId: user.id,
      durationMs,
    })
    return NextResponse.json({ data })
  } catch (error) {
    recordHttpMetric("/api/reports/learning/overview", 500)
    logger.error("request_failed", {
      userId: user.id,
      durationMs: Date.now() - startedAt,
      error,
    })
    throw error
  }
}
