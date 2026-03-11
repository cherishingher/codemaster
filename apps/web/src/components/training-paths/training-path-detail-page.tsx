"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Loader2,
  PlayCircle,
  RotateCw,
  Sparkles,
} from "lucide-react"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { RecommendedProductsList } from "@/components/content-access/recommended-products-list"
import { ProductPromoPanel } from "@/components/products/product-promo-panel"
import { ProgressBar } from "@/components/training-paths/progress-bar"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError, api } from "@/lib/api-client"
import { formatContentAccessRequirement } from "@/lib/content-access"
import { useAuth } from "@/lib/hooks/use-auth"
import { getTrackBySlug } from "@/lib/home-tracks"
import {
  formatTrainingPathProgressRate,
  getDifficultyBadgeClass,
  getDifficultyLabel,
  getTrainingPathLevelClass,
  getTrainingPathLevelLabel,
  type TrainingPathDetailResponse,
  type TrainingPathProgressResponse,
} from "@/lib/training-paths"

function getProblemStatusMeta(status: string) {
  switch (status) {
    case "solved":
      return {
        label: "已完成",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      }
    case "attempted":
      return {
        label: "进行中",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      }
    default:
      return {
        label: "未开始",
        className: "border-border/60 bg-secondary/40 text-foreground",
      }
  }
}

function LegacyTrackFallback({ slug }: { slug: string }) {
  const track = getTrackBySlug(slug)

  if (!track) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">训练路径不存在</h1>
            <Button asChild>
              <Link href="/training-paths">返回训练路径列表</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            历史专题入口
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{track.title}</h1>
          <p className="text-sm leading-7 text-muted-foreground">{track.description}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={track.primaryHref}>
                继续训练
                <PlayCircle className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/training-paths">切换到新训练路径页</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TrainingPathDetailPage() {
  const params = useParams()
  const rawId = params.id
  const rawSlug = params.slug
  const pathId = Array.isArray(rawId)
    ? rawId[0]
    : Array.isArray(rawSlug)
      ? rawSlug[0]
      : rawId ?? rawSlug ?? ""
  const { loggedIn } = useAuth()
  const [isSyncing, setIsSyncing] = React.useState(false)

  const { data, error, isLoading } = useSWR<TrainingPathDetailResponse>(
    pathId ? `/training-paths/${pathId}` : null,
    () => api.trainingPaths.get<TrainingPathDetailResponse>(pathId),
  )

  const {
    data: progressData,
    error: progressError,
    isLoading: progressLoading,
    mutate: mutateProgress,
  } = useSWR<TrainingPathProgressResponse>(
    loggedIn && pathId ? `/training-paths/${pathId}/progress` : null,
    () => api.trainingPaths.progress<TrainingPathProgressResponse>(pathId),
  )

  const detail = data?.data
  const progress = progressData?.data ?? null

  const shouldFallback =
    error instanceof ApiError && error.status === 404 && Boolean(getTrackBySlug(pathId))

  const handleSync = React.useCallback(async () => {
    if (!pathId) return
    setIsSyncing(true)
    try {
      await api.trainingPaths.syncProgress(pathId)
      await mutateProgress()
      toast.success("路径进度已同步")
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "同步失败")
    } finally {
      setIsSyncing(false)
    }
  }, [mutateProgress, pathId])

  if (shouldFallback) {
    return <LegacyTrackFallback slug={pathId} />
  }

  if (isLoading) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6 text-sm text-muted-foreground">训练路径加载中...</CardContent>
        </Card>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">训练路径不存在</h1>
            <p className="text-sm leading-7 text-muted-foreground">当前路径可能还未开放，或者链接参数不正确。</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/training-paths">返回列表</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/problems">去题库</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const requiredSourcesLabel = formatContentAccessRequirement(detail.access.policy.requiredSources)
  const summary = progress?.summary ?? detail.progress

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/training-paths">
            <ArrowLeft className="size-4" />
            返回训练路径列表
          </Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-6 p-7 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {detail.title}
                </Badge>
                <Badge variant="outline" className={getTrainingPathLevelClass(detail.level)}>
                  {getTrainingPathLevelLabel(detail.level)}
                </Badge>
                <Badge variant="outline">{requiredSourcesLabel}</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{detail.summary}</p>
                <p className="max-w-4xl text-base leading-8 text-muted-foreground">{detail.description}</p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">章节 / 题量</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {detail.chapterCount} 章 · {detail.itemCount} 题
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                入门 {detail.difficultySummary.easy} · 进阶 {detail.difficultySummary.medium} · 强化{" "}
                {detail.difficultySummary.hard}
              </p>
            </div>
          </div>

          {summary ? (
            <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">当前路径进度</p>
                  <p className="text-sm text-muted-foreground">
                    已完成 {summary.completedProblems}/{summary.totalProblems} ·{" "}
                    {formatTrainingPathProgressRate(summary.completionRate)}
                  </p>
                </div>
                {loggedIn ? (
                  <Button type="button" variant="secondary" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                    同步进度
                  </Button>
                ) : null}
              </div>
              <ProgressBar value={summary.completionRate} />

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">已完成</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{summary.completedProblems}</p>
                </div>
                <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">进行中</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{summary.attemptedProblems}</p>
                </div>
                <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近学习位置</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {summary.lastLearningPosition
                      ? `${summary.lastLearningPosition.chapterTitle} · ${summary.lastLearningPosition.problemTitle}`
                      : "尚未开始"}
                  </p>
                </div>
              </div>
            </div>
          ) : loggedIn && progressLoading ? (
            <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              正在加载路径进度...
            </div>
          ) : loggedIn && progressError ? (
            <div className="rounded-[1.4rem] border-[2px] border-red-400/40 bg-red-500/10 px-4 py-4 text-sm text-red-700">
              路径进度加载失败，请稍后重试。
            </div>
          ) : (
            <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              登录后会自动读取你的做题记录并计算路径进度、最近学习位置和题目状态。
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!detail.locked && summary?.lastLearningPosition ? (
              <Button asChild size="lg">
                <Link href={`/problems/${summary.lastLearningPosition.problemSlug}`}>
                  继续上次学习
                  <PlayCircle className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild size="lg" variant="secondary">
              <Link href="/products?type=training_path">
                查看训练路径商品
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {detail.locked ? (
        <section className="mt-10 space-y-6">
          <AccessLockCard
            access={detail.access}
            title="当前路径尚未解锁"
            description="未解锁时后端只返回路径介绍、章节摘要和锁态信息，不会下发完整题目清单。"
          />

          <div className="grid gap-4">
            {detail.chapters.map((chapter) => (
              <Card key={chapter.id} className="bg-background">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{chapter.title}</h2>
                      <p className="text-sm text-muted-foreground">{chapter.summary}</p>
                    </div>
                    <Badge variant="secondary">{chapter.problemCount} 道题</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">推荐解锁商品</h2>
              </div>
              <RecommendedProductsList
                products={detail.access.recommendedProducts}
                loggedIn={detail.access.userSummary.isLoggedIn}
              />
            </CardContent>
          </Card>
        </section>
      ) : (
        <section className="mt-10 space-y-6">
          <SectionHeading
            eyebrow="章节列表"
            title="按章节推进训练"
            description="章节与题目绑定关系由训练路径服务动态聚合，题目状态直接读取现有用户做题记录。"
          />

          <div className="space-y-5">
            {detail.chapters.map((chapter) => {
              const chapterProgress = progress?.chapters.find((item) => item.id === chapter.id)

              return (
                <Card key={chapter.id} className="bg-background">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                            第 {chapter.sortOrder + 1} 章
                          </Badge>
                          <Badge variant="secondary">{chapter.problemCount} 道题</Badge>
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{chapter.title}</h2>
                        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{chapter.summary}</p>
                      </div>

                      <div className="w-full max-w-xs rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-foreground">章节进度</span>
                          <span className="text-muted-foreground">
                            {chapterProgress
                              ? `${chapterProgress.completedProblems}/${chapterProgress.totalProblems}`
                              : `${chapter.problemCount} 题`}
                          </span>
                        </div>
                        <ProgressBar value={chapterProgress?.completionRate ?? 0} />
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {chapter.problems.map((item) => {
                        const problemProgress = chapterProgress?.problems.find(
                          (progressItem) => progressItem.problemId === item.problem.id,
                        )
                        const statusMeta = getProblemStatusMeta(problemProgress?.status ?? "not_started")
                        const isCurrent = chapterProgress?.currentProblemId === item.problem.id

                        return (
                          <div
                            key={item.problem.id}
                            className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">第 {item.orderIndex + 1} 题</Badge>
                                  <Badge variant="outline" className={getDifficultyBadgeClass(item.problem.difficulty)}>
                                    {getDifficultyLabel(item.problem.difficulty)}
                                  </Badge>
                                  <Badge variant="outline" className={statusMeta.className}>
                                    {statusMeta.label}
                                  </Badge>
                                  {isCurrent ? (
                                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                                      最近学习位置
                                    </Badge>
                                  ) : null}
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-foreground">{item.problem.title}</h3>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.problem.tags.slice(0, 6).map((tag) => (
                                      <Badge key={tag} variant="outline" className="bg-background">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                {problemProgress ? (
                                  <p className="text-sm text-muted-foreground">
                                    尝试 {problemProgress.attempts} 次 · 最佳分 {problemProgress.bestScore}
                                  </p>
                                ) : null}
                              </div>

                              <Button asChild variant="secondary">
                                <Link href={`/problems/${item.problem.slug}`}>
                                  去做这题
                                  <ArrowRight className="size-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="grid gap-4 lg:grid-cols-2">
          <ProductPromoPanel
            badge="训练路径商品"
            title="路径商品与内容权限中心已打通"
            description="路径详情页里的解锁入口会直接命中训练路径商品，支付成功后刷新页面即可看到完整内容。"
            href="/products?type=training_path"
            ctaLabel="查看训练路径商品"
          />
          <ProductPromoPanel
            badge="高级题解"
            title="训练路径和高级题解共享同一套权限判断"
            description="高级路径中的题目题解、视频解析和学习报告，都可以继续复用当前统一权限中心。"
            href="/content-packs"
            ctaLabel="查看内容包专区"
          />
        </div>
      </section>

      <section className="mt-12">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">与题目系统的关联方式</h2>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">
              训练路径只做“组织层”。题目本身继续来自现有 `Problem`，标签来自 `Tag / ProblemTag`，路径进度来自
              `UserProblemProgress`。这保证了做题、题解、订单和会员都能共享一套主数据。
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
