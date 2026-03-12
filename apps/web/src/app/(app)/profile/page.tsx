"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useAuth } from "@/lib/hooks/use-auth"
import { api } from "@/lib/api-client"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { LearningReportResponse } from "@/lib/learning-reports"
import type { ProgressListResponse } from "@/lib/progress"
import { Loader2, Trophy, Clock, Target, Calendar, CheckCircle2, ArrowRight } from "lucide-react"
import { getSubmissionStatusLabel } from "@/lib/submissions"

type SubmissionListResponse = {
  data: Array<{
    id: string
    status: string
    rawStatus?: string
    score?: number
    createdAt: string
    problem: {
      id: string
      slug: string
      title: string
    }
  }>
}

function getDifficultyLabel(difficulty: number) {
  switch (difficulty) {
    case 1:
      return "简单"
    case 2:
      return "中等"
    case 3:
      return "困难"
    default:
      return `难度 ${difficulty}`
  }
}

export default function ProfilePage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })

  const { data: progressResponse } = useSWR<ProgressListResponse>(
    user ? "/progress" : null,
    () => api.progress.list<ProgressListResponse>()
  )
  const { data: submissions } = useSWR<SubmissionListResponse>(
    user ? "/submissions?limit=10" : null,
    () => api.submissions.list<SubmissionListResponse>({ limit: "10" })
  )
  const { data: learningReport } = useSWR<LearningReportResponse>(
    user ? "/learning-reports/enhanced" : null,
    () => api.learningReports.get<LearningReportResponse>("enhanced")
  )

  const stats = React.useMemo(() => {
    const rows = progressResponse?.data ?? progressResponse?.items ?? []
    const solvedRows = rows.filter((item) => item.status >= 20 || item.solvedAt)
    return {
      attempted: rows.length,
      solved: {
        total: solvedRows.length,
        easy: solvedRows.filter((item) => item.problem.difficulty === 1).length,
        medium: solvedRows.filter((item) => item.problem.difficulty === 2).length,
        hard: solvedRows.filter((item) => item.problem.difficulty >= 3).length,
      },
      recentActivity: submissions?.data ?? [],
    }
  }, [progressResponse?.data, progressResponse?.items, submissions?.data])

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container py-8 px-4 md:px-6">
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <Avatar className="mb-4 h-24 w-24">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="text-2xl">
                  {user.name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold">{user.name || "Code Master"}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{user.email ?? user.phone}</p>
              <Badge variant="secondary" className="mb-2">
                {user.role ?? (user.roles?.includes("admin") ? "admin" : "student")}
              </Badge>
              <div className="mt-4 grid w-full grid-cols-2 gap-4 border-t pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.attempted}</div>
                  <div className="text-xs text-muted-foreground">尝试题目</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.solved.total}</div>
                  <div className="text-xs text-muted-foreground">解决题目</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-yellow-500" />
                做题状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">简单</span>
                <span className="font-medium">{stats.solved.easy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">中等</span>
                <span className="font-medium">{stats.solved.medium}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">困难</span>
                <span className="font-medium">{stats.solved.hard}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  已尝试题目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.attempted}</div>
                <p className="text-xs text-muted-foreground">累计有提交记录的题目</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  已通过题目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats.solved.total}</div>
                <p className="text-xs text-muted-foreground">聚合自 user_problem_progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  最近提交
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recentActivity.length}</div>
                <p className="text-xs text-muted-foreground">最近 10 条提交</p>
              </CardContent>
            </Card>
          </div>

          {learningReport?.data ? (
            learningReport.data.locked ? (
              <AccessLockCard
                access={learningReport.data.access}
                title="增强版学习报告尚未解锁"
                description="基础统计继续可见，活跃趋势、难度拆解和更完整的训练反馈需要统一权限中心放行后才能查看。"
                preview={
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">尝试题目</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {learningReport.data.preview.overview.attemptedProblems}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">已通过</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {learningReport.data.preview.overview.solvedProblems}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">提交总数</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {learningReport.data.preview.overview.totalSubmissions}
                      </p>
                    </div>
                  </div>
                }
              />
            ) : learningReport.data.report ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    增强版学习报告
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">总尝试次数</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {learningReport.data.report.overview.totalAttempts}
                    </p>
                  </div>
                  <div className="rounded-2xl border px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">通过率</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {(learningReport.data.report.overview.acceptedRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">难题通过</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {learningReport.data.report.solvedBreakdown.hard}
                    </p>
                  </div>
                  <div className="rounded-2xl border px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">路径进度</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {learningReport.data.report.trainingPaths.length}
                    </p>
                  </div>
                  <div className="md:col-span-4">
                    <Link href="/reports/learning" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                      查看完整学习报告
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : null
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <div className="text-sm text-muted-foreground">暂无提交记录</div>
              ) : (
                <div className="space-y-4">
                  {stats.recentActivity.map((activity) => {
                    const accepted =
                      activity.status === "ACCEPTED" || activity.rawStatus === "AC"
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`rounded-full p-2 ${
                              accepted
                                ? "bg-green-500/10 text-green-500"
                                : "bg-red-500/10 text-red-500"
                            }`}
                          >
                            {accepted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/problems/${activity.problem.slug}`}
                              className="font-medium hover:underline"
                            >
                              {activity.problem.title}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {getSubmissionStatusLabel(activity.status)}
                              {activity.score !== undefined ? ` · ${activity.score} 分` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Link
                            href={`/submissions/${activity.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            查看提交
                          </Link>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(activity.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>做题进度</CardTitle>
            </CardHeader>
            <CardContent>
              {!progressResponse?.data?.length && !progressResponse?.items?.length ? (
                <div className="text-sm text-muted-foreground">暂无做题进度</div>
              ) : (
                <div className="space-y-4">
                  {(progressResponse?.data ?? progressResponse?.items ?? []).slice(0, 12).map((row) => (
                    <div
                      key={`${row.problem.id}-${row.lastSubmissionId ?? row.updatedAt}`}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <Link
                          href={`/problems/${row.problem.slug}`}
                          className="font-medium hover:underline"
                        >
                          {row.problem.title}
                        </Link>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{getDifficultyLabel(row.problem.difficulty)}</span>
                          <span>尝试 {row.attempts}</span>
                          <span>最高分 {row.bestScore}</span>
                          <span>{getSubmissionStatusLabel(row.lastStatus)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.lastSubmissionId ? (
                          <Link
                            href={`/submissions/${row.lastSubmissionId}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            最近提交
                          </Link>
                        ) : null}
                        {row.status >= 20 ? (
                          <Badge className="bg-green-500/10 text-green-500" variant="outline">
                            已通过
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/10 text-yellow-500" variant="outline">
                            进行中
                          </Badge>
                        )}
                        {row.status >= 20 ? (
                          <Target className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
