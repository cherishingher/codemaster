"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, BarChart3, Flame, ShieldAlert, Target } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  formatReportRate,
} from "@/lib/learning-reports"
import type {
  PlatformLearningOverviewResponse,
  PlatformLearningTrendsResponse,
} from "@/lib/learning-analytics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProgressBar } from "@/components/training-paths/progress-bar"

function TrendBars({
  points,
}: {
  points: PlatformLearningTrendsResponse["data"]["trend"]
}) {
  const max = Math.max(1, ...points.map((item) => item.submissions))

  return (
    <div className="grid grid-cols-7 gap-2 xl:grid-cols-14">
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

export function AdminLearningAnalyticsPage() {
  const { data: overviewResponse, error: overviewError, mutate: mutateOverview } = useSWR<PlatformLearningOverviewResponse>(
    "/admin/analytics/learning/overview",
    () => api.admin.analytics.learning.overview<PlatformLearningOverviewResponse>(),
  )
  const { data: trendsResponse, error: trendsError, mutate: mutateTrends } = useSWR<PlatformLearningTrendsResponse>(
    "/admin/analytics/learning/trends",
    () => api.admin.analytics.learning.trends<PlatformLearningTrendsResponse>(),
  )

  const retry = React.useCallback(() => {
    void Promise.all([mutateOverview(), mutateTrends()])
  }, [mutateOverview, mutateTrends])

  if (!overviewResponse || !trendsResponse) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">平台学习分析加载中...</div>
  }

  if (overviewError || trendsError) {
    return (
      <div className="page-wrap py-10">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">平台学习分析加载失败</h1>
            <p className="text-sm leading-7 text-muted-foreground">当前无法完成平台级聚合，请稍后重试。</p>
            <Button onClick={retry} variant="secondary">
              重新加载
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overview = overviewResponse.data
  const trends = trendsResponse.data

  return (
    <div className="page-wrap py-10 md:py-14">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BarChart3 className="size-3.5" />
            Platform Analytics
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">平台学习分析</h1>
          <p className="max-w-3xl text-base leading-8 text-muted-foreground">
            聚合全站最近 {overview.window.days} 天的学习行为、标签、路径采用度、训练营与模拟赛参与情况，用于识别平台级增长和学习瓶颈。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">
            返回工具页
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card className="bg-background"><CardContent className="p-5"><p className="text-sm text-muted-foreground">总用户</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.kpis.totalUsers}</p></CardContent></Card>
        <Card className="bg-background"><CardContent className="p-5"><p className="text-sm text-muted-foreground">活跃用户</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.kpis.activeUsers}</p></CardContent></Card>
        <Card className="bg-background"><CardContent className="p-5"><p className="text-sm text-muted-foreground">提交总数</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.kpis.totalSubmissions}</p></CardContent></Card>
        <Card className="bg-background"><CardContent className="p-5"><p className="text-sm text-muted-foreground">通过率</p><p className="mt-2 text-3xl font-semibold text-foreground">{formatReportRate(overview.kpis.acceptedRate)}</p></CardContent></Card>
        <Card className="bg-background"><CardContent className="p-5"><p className="text-sm text-muted-foreground">营/赛参与</p><p className="mt-2 text-xl font-semibold text-foreground">{overview.kpis.campParticipants} / {overview.kpis.contestParticipants}</p></CardContent></Card>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">近 14 天趋势</h2>
            </div>
            <TrendBars points={trends.trend} />
            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              {trends.signal.summary}
              <div className="mt-3 flex flex-wrap gap-2">
                {trends.signal.peakDate ? <Badge variant="secondary">峰值日：{trends.signal.peakDate}</Badge> : null}
                {trends.signal.lowestDate ? <Badge variant="secondary">低谷日：{trends.signal.lowestDate}</Badge> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">学习风险分布</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.2rem] border-[2px] border-emerald-500/20 bg-emerald-500/5 px-4 py-4"><p className="text-sm text-emerald-700">低风险</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.bottleneckDistribution.low}</p></div>
              <div className="rounded-[1.2rem] border-[2px] border-amber-500/20 bg-amber-500/5 px-4 py-4"><p className="text-sm text-amber-700">中风险</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.bottleneckDistribution.medium}</p></div>
              <div className="rounded-[1.2rem] border-[2px] border-rose-500/20 bg-rose-500/5 px-4 py-4"><p className="text-sm text-rose-700">高风险</p><p className="mt-2 text-3xl font-semibold text-foreground">{overview.bottleneckDistribution.high}</p></div>
            </div>
            <div className="text-sm leading-7 text-muted-foreground">
              该分布基于最近 30 天活跃天数、尝试/通过关系和持续停滞信号做轻量预测，可直接指导召回、内容补强和训练营投放。
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">热门标签完成情况</h2>
            </div>
            <div className="space-y-4">
              {overview.topTags.map((item) => (
                <div key={item.tag} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-foreground">{item.tag}</div>
                    <Badge variant="secondary">{formatReportRate(item.completionRate)}</Badge>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>活跃用户 {item.engagedUsers}</span>
                    <span>尝试 {item.attemptedProblems}</span>
                    <span>通过 {item.solvedProblems}</span>
                  </div>
                  <ProgressBar value={item.completionRate} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">路径采用度</h2>
            </div>
            <div className="space-y-4">
              {overview.pathAdoption.map((item) => (
                <div key={item.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.level}</div>
                    </div>
                    <Badge variant="secondary">{formatReportRate(item.engagementRate)}</Badge>
                  </div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    参与用户 {item.engagedUsers} · 解通用户 {item.solvedUsers} · 解通率 {formatReportRate(item.solveRate)}
                  </div>
                  <ProgressBar value={item.solveRate} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-xl font-semibold text-foreground">平台优化建议</h2>
            <div className="space-y-3">
              {overview.recommendations.map((item, index) => (
                <div key={index} className="rounded-[1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
