"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowRight,
  BarChart3,
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
import { HeatmapCard } from "@/components/learning-reports/heatmap-card"
import { PersonalizedLearningInsightsCard } from "@/components/learning-reports/personalized-learning-insights-card"
import { ProgressBlock } from "@/components/learning-reports/progress-block"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { EmptyState, ErrorState, LoadingState } from "@/components/patterns/state-panel"
import { StatCard } from "@/components/patterns/stat-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "暂无"
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
  } = useSWR<PersonalizedLearningAnalyticsResponse>(
    user ? "/reports/learning/personalized" : null,
    () => api.reports.learning.personalized<PersonalizedLearningAnalyticsResponse>(),
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
    return (
      <div className="page-wrap py-10 md:py-14">
        <LoadingState title="正在加载训练看板" description="正在聚合最近 7 天的提交、通过率、路径进度和下一步建议。" />
      </div>
    )
  }

  if (overviewError || weeklyError || trendsError || !overviewResponse?.data || !weeklyResponse?.data || !trendsResponse?.data) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <ErrorState
          title="训练看板加载失败"
          description="当前无法完成学习报告聚合，请稍后重试。如果问题持续存在，再检查登录状态或后端接口。"
          action={
            <Button type="button" variant="secondary" onClick={handleRetry}>
              重新加载
            </Button>
          }
        />
      </div>
    )
  }

  const overview = overviewResponse.data
  const weekly = weeklyResponse.data
  const trends = trendsResponse.data
  const isEmpty = Boolean(weekly.emptyState?.isEmpty)

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Training Dashboard"
          title="最近 7 天训练看板"
          description="把提交趋势、通过率、标签分布、训练路径进度和下一步建议放在同一块工作区里，帮助你从“做了题”过渡到“看清训练状态”。"
          meta={
            <>
              <span>趋势</span>
              <span>·</span>
              <span>通过率</span>
              <span>·</span>
              <span>路径进度</span>
              <span>·</span>
              <span>薄弱点</span>
            </>
          }
          actions={
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
          }
          aside={
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">增强版报告</p>
                <StatusBadge tone={overview.enhancedAccess.allowed ? "success" : "warning"}>
                  {overview.enhancedAccess.allowed ? "已解锁" : "未解锁"}
                </StatusBadge>
              </div>
              {overview.enhancedAccess.allowed ? (
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">当前连学</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{overview.overview.currentStreak} 天</p>
                  </div>
                  <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最长连续</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{overview.overview.longestStreak} 天</p>
                  </div>
                  <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近提交</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(overview.overview.lastSubmissionAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="text-sm font-semibold text-foreground">增强版学习报告未解锁</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    当前需要 {formatContentAccessRequirement(overview.enhancedAccess.requiredSources)} 才能查看更完整的连续训练分析和增强建议。
                  </p>
                </div>
              )}
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Submissions"
            value={overview.overview.totalSubmissions}
            description="最近 7 天提交总数"
            icon={BarChart3}
            tone="primary"
          />
          <StatCard
            label="Attempted"
            value={overview.overview.attemptedProblems}
            description="有过提交的题目数量"
            icon={Target}
            tone="secondary"
          />
          <StatCard
            label="Solved"
            value={overview.overview.solvedProblems}
            description="最近 7 天至少通过一次的题目"
            icon={Flame}
            tone="accent"
          />
          <StatCard
            label="Accepted Rate"
            value={formatReportRate(overview.overview.acceptedRate)}
            description={`活跃 ${overview.overview.activeDays} 天`}
            icon={Crown}
            tone="warning"
          />
        </div>

        {isEmpty ? (
          <EmptyState
            title="最近 7 天还没有训练数据"
            description="去训练路径或题库完成几次提交后，这里会自动生成趋势、标签分布、路径进度和下一步建议。"
            href="/problems"
            actionLabel="去题库开始训练"
          />
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <SectionCard
                title="最近 7 天趋势"
                description="先看训练密度，再看通过率和难度分布，判断问题是做得少还是做得偏浅。"
                action={<Badge variant="secondary">{weekly.window.days} 天滚动窗口</Badge>}
              >
                <div className="space-y-5">
                  <HeatmapCard
                    title="训练热力"
                    description="按天查看提交强度和通过率，识别中断、爆发和低效训练日。"
                    points={trends.trend}
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-inset rounded-[1.25rem] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">通过率</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatReportRate(overview.overview.acceptedRate)}
                      </p>
                    </div>
                    <div className="surface-inset rounded-[1.25rem] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">通过题难度</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        简 {weekly.solvedBreakdown.easy} / 中 {weekly.solvedBreakdown.medium} / 难 {weekly.solvedBreakdown.hard}
                      </p>
                    </div>
                    <div className="surface-inset rounded-[1.25rem] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最后提交</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(overview.overview.lastSubmissionAt)}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="题目标签分布"
                description="聚焦最近一周高频但通过率不高的标签，优先补弱项。"
                action={<Tags className="size-4 text-primary" />}
              >
                <div className="space-y-3">
                  {weekly.tagDistribution.length === 0 ? (
                    <div className="text-sm text-muted-foreground">最近 7 天还没有可展示的标签数据。</div>
                  ) : (
                    weekly.tagDistribution.map((tag) => (
                      <ProgressBlock
                        key={tag.tag}
                        title={tag.tag}
                        subtitle={`尝试 ${tag.attemptedProblems} 题 · 通过 ${tag.solvedProblems} 题`}
                        progress={tag.completionRate}
                        valueLabel={formatReportRate(tag.completionRate)}
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <SectionCard
                title="当前训练路径进度"
                description="把正在进行的路径和最近学习位置收在一起，方便直接回到当前训练上下文。"
                action={<Route className="size-4 text-primary" />}
              >
                <div className="space-y-4">
                  {weekly.trainingPaths.length === 0 ? (
                    <div className="text-sm text-muted-foreground">当前还没有可展示的训练路径进度。</div>
                  ) : (
                    weekly.trainingPaths.map((path) => (
                      <div key={path.id} className="space-y-3 rounded-[1.35rem] border-[2px] border-border bg-card px-4 py-4">
                        <ProgressBlock
                          title={path.title}
                          subtitle={
                            path.currentChapterTitle
                              ? `当前章节：${path.currentChapterTitle}`
                              : `总题量 ${path.totalProblems}`
                          }
                          progress={path.completionRate}
                          badge={
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  path.locked
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                                )}
                              >
                                {path.locked ? formatContentAccessRequirement(path.requiredSources) : "已解锁"}
                              </Badge>
                              <Badge variant="secondary">{formatReportRate(path.completionRate)}</Badge>
                            </div>
                          }
                          footer={
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span>
                                已完成 {path.completedProblems}/{path.totalProblems}
                              </span>
                              <span>{path.lastLearningPositionTitle ? `最近：${path.lastLearningPositionTitle}` : "尚未开始"}</span>
                            </div>
                          }
                        />
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/training-paths/${path.slug}`}>
                            查看路径
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="下一步建议"
                description="不要只看统计结果，直接给出可以立刻执行的训练动作。"
                action={<Target className="size-4 text-primary" />}
              >
                <div className="space-y-3">
                  {overview.nextStepAdvice.map((advice, index) => (
                    <div key={`${index}-${advice}`} className="surface-inset rounded-[1.25rem] p-4">
                      <div className="flex items-start gap-3">
                        <div className="inline-flex size-8 items-center justify-center rounded-full border-[2px] border-border bg-background text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <p className="text-sm leading-7 text-muted-foreground">{advice}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {!overview.enhancedAccess.allowed ? (
                  <div className="mt-5">
                    <AccessLockCard
                      access={overview.enhancedAccess}
                      title="增强版报告未解锁"
                      description="更完整的趋势洞察、连续训练分析和增强建议继续走统一会员与商品权限体系。开通 VIP 后刷新页面即可生效。"
                    />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.25rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="flex items-start gap-3">
                      <Flame className="mt-1 size-4 text-primary" />
                      <div>
                        <p className="text-base font-semibold text-foreground">增强分析已接入</p>
                        <p className="mt-1 text-sm leading-7 text-muted-foreground">
                          这页已经打通提交记录、训练路径和会员权限体系，后续可继续在同一工作台里扩展更细的弱项分析和训练建议。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="个性化洞察"
              description="基于最近一周的行为和结果，补一层更贴近个人训练状态的分析。"
            >
              <PersonalizedLearningInsightsCard
                data={personalizedResponse?.data ?? null}
                loading={!personalizedResponse && !personalizedError}
              />
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <AiRecommendationsCard />
              <AiLearningPlanCard
                defaultGoal={
                  weekly.tagDistribution[0]?.tag
                    ? `最近一周重点补强 ${weekly.tagDistribution[0].tag}，并继续当前训练路径`
                    : "提升最近一周的训练效率并继续当前路径"
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
