"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowRight,
  Baby,
  BarChart3,
  Crown,
  GraduationCap,
  Medal,
  Trophy,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type {
  ParentBindingMutationResponse,
  ParentChildrenResponse,
  ParentLearningOverviewResponse,
} from "@/lib/parent-reports"
import { formatReportRate } from "@/lib/learning-reports"
import { formatPriceCents } from "@/lib/products"
import { useAuth } from "@/lib/hooks/use-auth"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { ProgressBar } from "@/components/training-paths/progress-bar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

function LoadingState() {
  return <div className="page-wrap py-10 text-sm text-muted-foreground">家长报告加载中...</div>
}

export function ParentReportPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const [studentId, setStudentId] = React.useState<string | null>(null)
  const [identifier, setIdentifier] = React.useState("")
  const [relation, setRelation] = React.useState("parent")
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const { data: childrenResponse, error: childrenError, mutate: mutateChildren } = useSWR<ParentChildrenResponse>(
    user ? "/parent/children" : null,
    () => api.parent.children<ParentChildrenResponse>(),
    {
      onSuccess(data) {
        if (!studentId && data.data.items[0]) {
          setStudentId(data.data.items[0].studentId)
        }
      },
    },
  )

  const overviewKey = user && studentId ? `/parent/reports/overview?studentId=${studentId}` : null
  const { data: overviewResponse, error: overviewError, mutate: mutateOverview } = useSWR<ParentLearningOverviewResponse>(
    overviewKey,
    () => api.parent.overview<ParentLearningOverviewResponse>(studentId ? { studentId } : undefined),
  )

  const submitBinding = async () => {
    if (!identifier.trim()) return

    setSubmitting(true)
    try {
      const response = await api.parent.bind<ParentBindingMutationResponse>({
        identifier: identifier.trim(),
        relation,
        note: note.trim() || undefined,
      })

      setIdentifier("")
      setNote("")
      await mutateChildren()
      setStudentId(response.data.studentId)
      await mutateOverview()
      toast.success("已建立家长绑定关系")
    } catch (error) {
      const message = error instanceof Error ? error.message : "绑定学生失败"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const removeBinding = async (relationId: string) => {
    try {
      await api.parent.unbind(relationId)
      const nextChildren = await mutateChildren()
      const nextStudentId = nextChildren?.data.items[0]?.studentId ?? null
      setStudentId(nextStudentId)
      await mutateOverview()
      toast.success("已解除家长绑定")
    } catch (error) {
      const message = error instanceof Error ? error.message : "解除绑定失败"
      toast.error(message)
    }
  }

  if (loading || !user || !childrenResponse || (studentId && !overviewResponse && !overviewError)) {
    return <LoadingState />
  }

  if (childrenError || overviewError) {
    return (
      <div className="page-wrap py-10">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">家长报告加载失败</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              当前无法完成孩子学习、训练营和模拟赛数据聚合，请稍后重试。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const children = childrenResponse.data.items
  const payload = overviewResponse?.data

  if (!payload || !payload.selectedChild) {
    return (
      <div className="page-wrap py-10">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-8">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Baby className="size-3.5" />
              Parent Report
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">当前还没有绑定学生</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              先建立家长与学生关系后，这里才会生成最近 7 天的学习、训练营和模拟赛整合报告。
            </p>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_1fr_auto]">
              <Input
                placeholder="学生邮箱或手机号"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={relation}
                onChange={(event) => setRelation(event.target.value)}
              >
                <option value="parent">家长</option>
                <option value="mother">妈妈</option>
                <option value="father">爸爸</option>
                <option value="guardian">监护人</option>
              </select>
              <Input
                placeholder="备注（可选）"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button onClick={submitBinding} disabled={submitting || !identifier.trim()}>
                {submitting ? "绑定中..." : "添加学生"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Baby className="size-3.5" />
                Parent Report
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {payload.selectedChild.name} 的最近 7 天学习总览
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                复用一期学习报告、二期训练营和模拟赛数据，用家长更容易理解的方式展示最近学习状态、训练营推进和比赛表现。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <div
                  key={child.studentId}
                  className={`inline-flex items-center gap-2 rounded-full border-[2px] px-3 py-2 text-sm transition-colors ${
                    payload.selectedChild?.studentId === child.studentId
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <button type="button" onClick={() => setStudentId(child.studentId)}>
                    {child.name}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => removeBinding(child.relationId)}
                  >
                    解除
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-[1.4rem] border-[2px] border-dashed border-border bg-card/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Baby className="size-4 text-primary" />
                轻量家长绑定
              </div>
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_1fr_auto]">
                <Input
                  placeholder="学生邮箱或手机号"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                >
                  <option value="parent">家长</option>
                  <option value="mother">妈妈</option>
                  <option value="father">爸爸</option>
                  <option value="guardian">监护人</option>
                </select>
                <Input
                  placeholder="备注（可选）"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button onClick={submitBinding} disabled={submitting || !identifier.trim()}>
                  {submitting ? "绑定中..." : "添加学生"}
                </Button>
              </div>
            </div>

            {payload.overview ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">活跃天数</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{payload.overview.activeDays}</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">尝试题数</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{payload.overview.attemptedProblems}</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">通过题数</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{payload.overview.solvedProblems}</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">通过率</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {formatReportRate(payload.overview.acceptedRate)}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-7 md:p-10">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">增强版家长视角</h2>
            </div>

            {payload.enhancedAccess.allowed ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">训练路径</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{payload.currentTrainingPaths.length}</p>
                </div>
                <div className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                  <p className="text-sm text-muted-foreground">最近比赛</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{payload.recentContests.length}</p>
                </div>
              </div>
            ) : (
              <AccessLockCard
                access={payload.enhancedAccess}
                title="增强版家长报告未解锁"
                description="训练营推进、模拟赛结果与更细粒度的家长建议继续走统一会员与商品权限体系。"
              />
            )}
          </CardContent>
        </Card>
      </section>

      {payload.emptyState ? (
        <section className="mt-10">
          <Card className="bg-background">
            <CardContent className="space-y-3 p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{payload.emptyState.title}</h2>
              <p className="text-sm leading-7 text-muted-foreground">{payload.emptyState.description}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">当前训练路径</h2>
            </div>
            <div className="space-y-3">
              {payload.currentTrainingPaths.length ? (
                payload.currentTrainingPaths.map((path) => (
                  <div key={path.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">{path.title}</p>
                      <Badge variant="secondary">{Math.round(path.completionRate * 100)}%</Badge>
                    </div>
                    <div className="mb-3 text-sm text-muted-foreground">
                      已完成 {path.completedProblems}/{path.totalProblems}
                    </div>
                    <ProgressBar value={path.completionRate} />
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前还没有可展示的训练路径进度。</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">训练营推进</h2>
            </div>
            <div className="space-y-3">
              {payload.activeCamps.length ? (
                payload.activeCamps.map((camp) => (
                  <div key={camp.classId} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">{camp.classTitle}</p>
                      <Badge variant="secondary">{camp.status === "completed" ? "已结营" : "进行中"}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                      <span>任务 {camp.completedTasks}/{camp.totalTasks}</span>
                      <span>通过率 {formatReportRate(camp.acceptanceRate)}</span>
                      <span>班级排名 {camp.finalRank ?? "-"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前没有训练营数据。</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">最近模拟赛</h2>
            </div>
            <div className="space-y-3">
              {payload.recentContests.length ? (
                payload.recentContests.map((contest) => (
                  <div key={contest.contestId} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">{contest.contestName}</p>
                      <Badge variant="secondary">{contest.status}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4 text-sm text-muted-foreground">
                      <span>总榜 {contest.rank ?? "-"}</span>
                      <span>分组 {contest.groupRank ?? "-"}</span>
                      <span>通过 {contest.solvedCount}</span>
                      <span>提交 {contest.submissionCount}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前还没有模拟赛数据。</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Medal className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">家长建议</h2>
            </div>
            <div className="space-y-3">
              {payload.parentAdvice.length ? (
                payload.parentAdvice.map((item) => (
                  <div key={item} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4 text-sm leading-7 text-muted-foreground">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前还没有可展示的建议。</div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/reports/learning">
                  查看学生学习报告
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/contests">查看模拟赛</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">推荐下一步产品</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {payload.recommendedProducts.length ? (
                payload.recommendedProducts.map((item) => (
                  <div key={item.product.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">{item.product.name}</p>
                      <Badge variant="secondary">{item.product.type}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{item.reason}</p>
                    {item.matchedTags.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.matchedTags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        {formatPriceCents(item.product.defaultSku.priceCents, item.product.defaultSku.currency)}
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/products/${item.product.slug ?? item.product.id}`}>查看商品</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前没有额外推荐商品，可继续保持当前学习节奏。</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
