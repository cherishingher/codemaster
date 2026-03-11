"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  Crown,
  Flame,
  Loader2,
  Route,
  RotateCw,
  Tags,
  Target,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatContentAccessRequirement } from "@/lib/content-access"
import type { PersonalizedLearningAnalyticsResponse } from "@/lib/learning-analytics"
import type {
  LearningReportOverviewResponse,
  LearningReportTrendsResponse,
  LearningReportWeeklyResponse,
} from "@/lib/learning-reports"
import { formatReportRate } from "@/lib/learning-reports"
import { useAuth } from "@/lib/hooks/use-auth"
import { AiLearningPlanCard } from "@/components/ai/ai-learning-plan-card"
import { AiRecommendationsCard } from "@/components/ai/ai-recommendations-card"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { PersonalizedLearningInsightsCard } from "@/components/learning-reports/personalized-learning-insights-card"
import { ProgressBar } from "@/components/training-paths/progress-bar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function TrendBars({
  points,
}: {
  points: LearningReportTrendsResponse["data"]["trend"]
}) {
  const max = Math.max(1, ...points.map((item) => item.submissions))

  return (
    <div className="grid grid-cols-7 gap-2">
      {points.map((point) => (
        <div key={point.date} className="flex flex-col items-center gap-2">
          <div className="flex h-28 w-full items-end rounded-[1rem] border-[2px] border-border bg-card px-1.5 py-1.5">
            <div
              className="w-full rounded-[0.7rem] bg-primary"
              style={{
                height: `${Math.max(8, (point.submissions / max) * 100)}%`,
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground">{point.date.slice(5)}</p>
            <p className="text-xs font-medium text-foreground">{point.submissions}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingState() {
  return <div className="page-wrap py-10 text-sm text-muted-foreground">学习报告加载中...</div>
}

function EmptyState() {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-4 p-8 text-center">
        <div className="inline-flex items-center gap-2 self-center rounded-full border-[2px] border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          <BarChart3 className="size-3.5" />
          Learning Overview
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">最近 7 天还没有学习数据</h2>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground">
            去训练路径或题库完成几次提交后，这里会自动生成活跃趋势、标签分布、路径进度和下一步建议。
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/training-paths">
              去训练路径
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/problems">去题库做题</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="page-wrap py-10">
      <Card className="bg-background">
        <CardContent className="space-y-4 p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">学习报告加载失败</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              当前无法完成最近 7 天报告聚合，请稍后重试。如果问题持续存在，再检查登录状态或后端接口。
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onRetry}>
            重新加载
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function LearningReportPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const [isSyncing, setIsSyncing] = React.useState(false)

  const overviewKey = user ? "/reports/learning/overview" : null
  const weeklyKey = user ? "/reports/learning/weekly" : null
  const trendsKey = user ? "/reports/learning/trends" : null

  const {
    data: overviewResponse,
    mutate: mutateOverview,
    error: overviewError,
    isLoading: overviewLoading,
  } = useSWR<LearningReportOverviewResponse>(overviewKey, () =>
    api.reports.learning.overview<LearningReportOverviewResponse>(),
  )
  const {
    data: weeklyResponse,
    mutate: mutateWeekly,
    error: weeklyError,
    isLoading: weeklyLoading,
  } = useSWR<LearningReportWeeklyResponse>(weeklyKey, () =>
    api.reports.learning.weekly<LearningReportWeeklyResponse>(),
  )
  const {
    data: trendsResponse,
    mutate: mutateTrends,
    error: trendsError,
    isLoading: trendsLoading,
  } = useSWR<LearningReportTrendsResponse>(trendsKey, () =>
    api.reports.learning.trends<LearningReportTrendsResponse>(),
  )
  const {
    data: personalizedResponse,
    mutate: mutatePersonalized,
    error: personalizedError,
  } = useSWR<PersonalizedLearningAnalyticsResponse>(user ? "/reports/learning/personalized" : null, () =>
    api.reports.learning.personalized<PersonalizedLearningAnalyticsResponse>(),
  )

  const handleRetry = React.useCallback(() => {
    void Promise.all([mutateOverview(), mutateWeekly(), mutateTrends(), mutatePersonalized()])
  }, [mutateOverview, mutateWeekly, mutateTrends, mutatePersonalized])

  const handleSyncPaths = React.useCallback(async () => {
    const pathIds = weeklyResponse?.data.trainingPaths.map((item) => item.id) ?? []
    if (pathIds.length === 0) {
      toast.info("当前没有可同步的训练路径")
      return
    }

    setIsSyncing(true)
    try {
      await Promise.all(pathIds.map((id) => api.trainingPaths.syncProgress(id)))
      await Promise.all([mutateOverview(), mutateWeekly(), mutateTrends(), mutatePersonalized()])
      toast.success("训练路径进度已同步到学习报告")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步失败")
    } finally {
      setIsSyncing(false)
    }
  }, [mutateOverview, mutatePersonalized, mutateTrends, mutateWeekly, weeklyResponse?.data.trainingPaths])

  if (loading || overviewLoading || weeklyLoading || trendsLoading || !user) {
    return <LoadingState />
  }

  if (overviewError || weeklyError || trendsError || !overviewResponse?.data || !weeklyResponse?.data || !trendsResponse?.data) {
    return <ErrorState onRetry={handleRetry} />
  }

  const overview = overviewResponse.data
  const weekly = weeklyResponse.data
  const trends = trendsResponse.data
  const isEmpty = Boolean(weekly.emptyState?.isEmpty)

  return (
    <div className="page-wrap py-10 md:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <BarChart3 className="size-3.5" />
                Learning Report
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">最近 7 天学习总览</h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                直接聚合现有提交记录、AC 记录、题目标签和训练路径进度，不额外建立第二套学习真相表。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">活跃天数</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{overview.overview.activeDays}</p>
              </div>
              <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">尝试题数</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{overview.overview.attemptedProblems}</p>
              </div>
              <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">通过题数</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{overview.overview.solvedProblems}</p>
              </div>
              <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">通过率</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {formatReportRate(overview.overview.acceptedRate)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={handleSyncPaths} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                同步路径进度
              </Button>
              <Button asChild>
                <Link href="/training-paths">
                  查看训练路径
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-7 md:p-10">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">增强版报告</h2>
            </div>

            {overview.enhancedAccess.allowed ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">当前连学</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{overview.overview.currentStreak} 天</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">最长连续</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{overview.overview.longestStreak} 天</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">最近提交</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {overview.overview.lastSubmissionAt
                      ? new Date(overview.overview.lastSubmissionAt).toLocaleString("zh-CN")
                      : "暂无"}
                  </p>
                </div>
              </div>
            ) : (
              <AccessLockCard
                access={overview.enhancedAccess}
                title="增强版学习报告未解锁"
                description="更完整的趋势洞察、连续训练分析和增强建议继续走统一会员与商品权限体系。开通 VIP 后刷新页面即可生效。"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {isEmpty ? <section className="mt-10"><EmptyState /></section> : null}

      {!isEmpty ? (
        <>
          <section className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="bg-background">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <Tags className="size-4 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">题目标签分布</h2>
                </div>
                <div className="space-y-3">
                  {weekly.tagDistribution.length === 0 ? (
                    <div className="text-sm text-muted-foreground">最近 7 天还没有可展示的标签数据。</div>
                  ) : (
                    weekly.tagDistribution.map((tag) => (
                      <div key={tag.tag} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-foreground">{tag.tag}</p>
                          <Badge variant="secondary">{formatReportRate(tag.completionRate)}</Badge>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>尝试 {tag.attemptedProblems}</span>
                          <span>通过 {tag.solvedProblems}</span>
                        </div>
                        <ProgressBar value={tag.completionRate} />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <CalendarRange className="size-4 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">最近 7 天趋势</h2>
                </div>
                <TrendBars points={trends.trend} />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1rem] border-[2px] border-border bg-card px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">提交总数</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{overview.overview.totalSubmissions}</p>
                  </div>
                  <div className="rounded-[1rem] border-[2px] border-border bg-card px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">通过题难度</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      简 {weekly.solvedBreakdown.easy} / 中 {weekly.solvedBreakdown.medium} / 难 {weekly.solvedBreakdown.hard}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border-[2px] border-border bg-card px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">统计窗口</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{weekly.window.days} 天滚动统计</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-10 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="bg-background">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <Route className="size-4 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">当前训练路径进度</h2>
                </div>
                <div className="space-y-4">
                  {weekly.trainingPaths.length === 0 ? (
                    <div className="text-sm text-muted-foreground">当前还没有可展示的训练路径进度。</div>
                  ) : (
                    weekly.trainingPaths.map((path) => (
                      <div key={path.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-base font-semibold text-foreground">{path.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {path.currentChapterTitle
                                ? `当前章节：${path.currentChapterTitle}`
                                : `总题量 ${path.totalProblems}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {path.locked ? (
                              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-700">
                                {formatContentAccessRequirement(path.requiredSources)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                                已解锁
                              </Badge>
                            )}
                            <Badge variant="secondary">{formatReportRate(path.completionRate)}</Badge>
                          </div>
                        </div>
                        <ProgressBar value={path.completionRate} />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>
                            已完成 {path.completedProblems}/{path.totalProblems}
                          </span>
                          <span>{path.lastLearningPositionTitle ? `最近：${path.lastLearningPositionTitle}` : "尚未开始"}</span>
                        </div>
                        <div className="mt-4">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/training-paths/${path.slug}`}>
                              查看路径
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">下一步建议</h2>
                </div>
                <div className="space-y-3">
                  {overview.nextStepAdvice.map((advice, index) => (
                    <div key={index} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="inline-flex size-8 items-center justify-center rounded-full border-[2px] border-border bg-background text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <p className="text-sm leading-7 text-muted-foreground">{advice}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Flame className="mt-1 size-4 text-primary" />
                    <div>
                      <p className="text-base font-semibold text-foreground">会员 / 商品 / 权限已打通</p>
                      <p className="mt-1 text-sm leading-7 text-muted-foreground">
                        当前学习报告直接复用训练路径、会员状态和商品体系。VIP 开通成功后，这里的增强版报告无需换链路即可立即解锁。
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-10">
            <PersonalizedLearningInsightsCard
              data={personalizedResponse?.data ?? null}
              loading={!personalizedResponse && !personalizedError}
            />
          </section>

          <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <AiRecommendationsCard />
            <AiLearningPlanCard
              defaultGoal={
                weekly.tagDistribution[0]?.tag
                  ? `最近一周重点补强 ${weekly.tagDistribution[0].tag}，并继续当前训练路径`
                  : "提升最近一周的训练效率并继续当前路径"
              }
            />
          </section>
        </>
      ) : null}
    </div>
  )
}
