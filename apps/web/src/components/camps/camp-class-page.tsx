"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Crown,
  Medal,
  RefreshCw,
  Trophy,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { CampCheckinResponse, CampClassDetailResponse } from "@/lib/camps"
import { formatContentAccessRequirement } from "@/lib/content-access"
import {
  formatCampDateRange,
  getCampClassStatusLabel,
  getCampTaskCompletionLabel,
} from "@/lib/camps"
import { formatReportRate } from "@/lib/learning-reports"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { RecommendedProductsList } from "@/components/content-access/recommended-products-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function CampClassPage() {
  const params = useParams()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const [checkingTaskId, setCheckingTaskId] = React.useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR<CampClassDetailResponse>(
    id ? `/camp-classes/${id}` : null,
    () => api.campClasses.get<CampClassDetailResponse>(id as string),
  )

  const detail = data?.data

  const handleCheckin = React.useCallback(
    async (taskId: string) => {
      if (!detail) return
      setCheckingTaskId(taskId)
      try {
        await api.camps.checkin<CampCheckinResponse>(detail.camp.id, {
          classId: detail.class.id,
          taskId,
        })
        toast.success("打卡成功")
        await mutate()
      } catch (checkinError) {
        toast.error(checkinError instanceof Error ? checkinError.message : "打卡失败")
      } finally {
        setCheckingTaskId(null)
      }
    },
    [detail, mutate],
  )

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          训练营班级不存在或暂未开放。
        </div>
      </div>
    )
  }

  if (isLoading || !detail) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">训练营班级加载中...</div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href={`/camps/${detail.camp.slug}`}>
            <ArrowLeft className="size-4" />
            返回训练营详情
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/camps">回到训练营列表</Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-6 p-7 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {detail.camp.title}
                </Badge>
                <Badge variant="secondary">{getCampClassStatusLabel(detail.class.status)}</Badge>
                <Badge variant="outline">{formatContentAccessRequirement(detail.access.policy.requiredSources)}</Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">{detail.class.title}</h1>
                <p className="text-base leading-8 text-muted-foreground">
                  {detail.class.summary || detail.camp.summary || "当前班级暂无更多介绍。"}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
              <p className="text-sm text-muted-foreground">营期与名额</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCampDateRange(detail.class.startAt, detail.class.endAt)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {detail.class.capacity ? `${detail.class.occupiedSeats}/${detail.class.capacity}` : "不限人数"}
              </p>
            </div>
          </div>

          {detail.enrollment ? (
            <div className="rounded-[1.4rem] border-[3px] border-primary/30 bg-primary/10 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">我的班级状态</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{detail.enrollment.status}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  最近活跃：{detail.enrollment.lastActiveAt ? new Date(detail.enrollment.lastActiveAt).toLocaleString("zh-CN") : "暂无"}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!detail.access.allowed ? (
        <section className="mt-10 space-y-6">
          <AccessLockCard
            access={detail.access}
            title="当前班级尚未解锁"
            description="未完成报名或未支付成功时，班级页只展示最小可见信息，不返回完整任务、打卡和排行榜数据。"
            preview={
              <div className="space-y-3">
                {detail.previewTasks.length ? (
                  detail.previewTasks.map((task) => (
                    <div key={task.id} className="rounded-[1rem] border-[2px] border-border bg-background px-4 py-3">
                      <p className="text-sm font-medium text-foreground">Day {task.dayIndex} · {task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{task.summary || task.dateKey}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">当前班级尚未配置每日任务。</p>
                )}
              </div>
            }
          />

          <RecommendedProductsList
            products={detail.access.recommendedProducts}
            loggedIn={detail.access.userSummary.isLoggedIn}
          />
        </section>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="bg-background">
            <CardContent className="space-y-5 p-6 md:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">每日任务</h2>
                  <p className="text-sm text-muted-foreground">基于现有题目、训练路径或题解组织出每日训练目标。</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => mutate()}>
                  <RefreshCw className="size-4" />
                  刷新
                </Button>
              </div>

              <div className="space-y-4">
                {detail.tasks.length ? (
                  detail.tasks.map((task) => (
                    <div key={task.id} className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Day {task.dayIndex}</Badge>
                            <Badge variant="secondary">{getCampTaskCompletionLabel(task.completionStatus)}</Badge>
                            {task.isRequired ? <Badge variant="outline">必做</Badge> : null}
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-foreground">{task.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {task.summary || `${new Date(task.taskDate).toLocaleDateString("zh-CN")} · ${task.points} 分`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {task.problem ? (
                            <Button asChild variant="secondary">
                              <Link href={`/problems/${task.problem.slug}`}>
                                去做题
                                <ArrowRight className="size-4" />
                              </Link>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            onClick={() => handleCheckin(task.id)}
                            disabled={!task.canCheckin || checkingTaskId === task.id}
                          >
                            <CheckCircle2 className="size-4" />
                            {task.checkedIn ? "已打卡" : checkingTaskId === task.id ? "提交中..." : "打卡"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5 text-sm text-muted-foreground">
                    当前班级还没有配置每日任务。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Trophy className="size-5 text-primary" />
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">营内排行榜</h2>
                </div>
                <div className="space-y-3">
                  {detail.ranking?.items.length ? (
                    detail.ranking.items.map((item) => (
                      <div
                        key={item.userId}
                        className="flex items-center justify-between rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="inline-flex size-10 items-center justify-center rounded-full border-[2px] border-border bg-background font-semibold text-foreground">
                            {item.rank}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              任务 {item.completedTaskCount} · 打卡 {item.checkinCount} · 解题 {item.solvedProblemCount}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-foreground">{item.score}</p>
                          <p className="text-xs text-muted-foreground">{item.activeDays} 天活跃</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                      当前还没有足够的数据生成排行榜。
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Crown className="size-5 text-primary" />
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">结营报告</h2>
                </div>

                {detail.graduationReport ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-sm text-muted-foreground">任务完成</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {detail.graduationReport.completedTasks}/{detail.graduationReport.totalTasks}
                        </p>
                      </div>
                      <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-sm text-muted-foreground">通过率</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatReportRate(detail.graduationReport.acceptanceRate)}
                        </p>
                      </div>
                      <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-sm text-muted-foreground">活跃天数</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{detail.graduationReport.activeDays}</p>
                      </div>
                      <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-sm text-muted-foreground">当前排名</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {detail.graduationReport.finalRank ?? "未上榜"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Medal className="size-4 text-primary" />
                        <p className="font-medium text-foreground">下一步建议</p>
                      </div>
                      <div className="space-y-2 text-sm leading-7 text-muted-foreground">
                        {detail.graduationReport.advice.map((item) => (
                          <p key={item}>{item}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                    当前还没有可展示的结营报告数据。
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-2">
                  <CalendarRange className="size-4 text-primary" />
                  <p className="font-medium text-foreground">班级信息</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  营期：{formatCampDateRange(detail.class.startAt, detail.class.endAt)}
                </p>
                <p className="text-sm text-muted-foreground">教练：{detail.class.coachName || "CodeMaster 教研"}</p>
                <p className="text-sm text-muted-foreground">
                  名额：{detail.class.capacity ? `${detail.class.occupiedSeats}/${detail.class.capacity}` : "不限人数"}
                </p>
                <p className="text-sm text-muted-foreground">
                  访问方式：{formatContentAccessRequirement(detail.access.policy.requiredSources)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
