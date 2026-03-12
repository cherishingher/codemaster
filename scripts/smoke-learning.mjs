import { assert, getSmokeConfig, logStep, login, requestJson, seedIfConfigured } from "./lib/smoke-common.mjs"

const config = getSmokeConfig()

async function main() {
  await seedIfConfigured(config)

  const session = await login(config.baseUrl, config.email, config.password)
  logStep("logged_in", { email: config.email, userId: session.user?.id ?? null })

  const trainingPath = await requestJson(config.baseUrl, "/api/training-paths/dynamic-programming", {
    cookie: session.cookie,
  })
  assert(trainingPath.data?.data?.locked === false, "expected unlocked dynamic programming path")
  logStep("training_path_ready", {
    slug: trainingPath.data.data.slug,
    locked: trainingPath.data.data.locked,
  })

  const overview = await requestJson(config.baseUrl, "/api/reports/learning/overview", {
    cookie: session.cookie,
  })
  assert(overview.data?.overview || overview.data?.data?.overview, "learning overview payload missing overview")
  logStep("report_overview_ok")

  const weekly = await requestJson(config.baseUrl, "/api/reports/learning/weekly", {
    cookie: session.cookie,
  })
  const weeklyData = weekly.data?.tagDistribution ? weekly.data : weekly.data?.data
  assert(Array.isArray(weeklyData?.tagDistribution), "weekly report tag distribution missing")
  logStep("report_weekly_ok", { tags: weeklyData.tagDistribution.length })

  const trends = await requestJson(config.baseUrl, "/api/reports/learning/trends", {
    cookie: session.cookie,
  })
  const trendData = trends.data?.trend ? trends.data : trends.data?.data
  assert(Array.isArray(trendData?.trend), "trend payload missing trend array")
  logStep("report_trends_ok", { points: trendData.trend.length })

  const personalized = await requestJson(config.baseUrl, "/api/reports/learning/personalized", {
    cookie: session.cookie,
  })
  assert(
    personalized.data?.data?.prediction?.summary || personalized.data?.data?.trendSignal?.summary,
    "personalized report summary missing",
  )
  logStep("report_personalized_ok")

  console.log("[smoke] learning ok")
}

main().catch((error) => {
  console.error("[smoke] learning failed", error)
  process.exitCode = 1
})
