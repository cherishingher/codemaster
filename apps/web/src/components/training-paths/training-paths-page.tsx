"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, BookOpen, Crown, Lock, Search } from "lucide-react"
import { api } from "@/lib/api-client"
import { formatContentAccessRequirement } from "@/lib/content-access"
import {
  formatTrainingPathProgressRate,
  getTrainingPathLevelClass,
  getTrainingPathLevelLabel,
  type TrainingPathListItem,
  type TrainingPathListResponse,
} from "@/lib/training-paths"
import { ProductPromoPanel } from "@/components/products/product-promo-panel"
import { SectionHeading } from "@/components/patterns/section-heading"
import { UnlockAccessModal } from "@/components/content-access/unlock-access-modal"
import { ProgressBar } from "@/components/training-paths/progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function TrainingPathCard({ item }: { item: TrainingPathListItem }) {
  const requiredSourcesLabel = formatContentAccessRequirement(item.access.policy.requiredSources)

  return (
    <Card className="bg-background transition-transform hover:-translate-y-0.5">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                {item.title}
              </Badge>
              <Badge variant="outline" className={getTrainingPathLevelClass(item.level)}>
                {getTrainingPathLevelLabel(item.level)}
              </Badge>
              {item.locked ? (
                <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-700">
                  <Lock className="mr-1 size-3.5" />
                  {requiredSourcesLabel}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                  已解锁
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{item.summary}</p>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{item.description}</p>
            </div>
          </div>

          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-3 text-right">
            <p className="text-sm text-muted-foreground">章节 / 题量</p>
            <p className="text-lg font-semibold text-foreground">
              {item.chapterCount} 章 · {item.itemCount} 题
            </p>
          </div>
        </div>

        {item.previewChapters.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {item.previewChapters.map((chapter) => (
              <div key={chapter.id} className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
                <p className="text-base font-semibold text-foreground">{chapter.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{chapter.problemCount} 道题</p>
              </div>
            ))}
          </div>
        ) : null}

        {item.progress ? (
          <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">当前进度</p>
              <p className="text-sm text-muted-foreground">
                {item.progress.completedProblems}/{item.progress.totalProblems} ·{" "}
                {formatTrainingPathProgressRate(item.progress.completionRate)}
              </p>
            </div>
            <ProgressBar value={item.progress.completionRate} />
            {item.progress.lastLearningPosition ? (
              <p className="mt-3 text-sm text-muted-foreground">
                最近学习：{item.progress.lastLearningPosition.chapterTitle} ·{" "}
                {item.progress.lastLearningPosition.problemTitle}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          {item.access.message}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/training-paths/${item.slug}`}>
              查看路径详情
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {item.locked ? <UnlockAccessModal access={item.access} triggerLabel="查看解锁方案" /> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function TrainingPathsPage() {
  const [query, setQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(query)

  const params = React.useMemo(
    () => (deferredQuery.trim() ? { q: deferredQuery.trim() } : undefined),
    [deferredQuery],
  )

  const { data, error, isLoading } = useSWR<TrainingPathListResponse>(
    deferredQuery ? `/training-paths?q=${encodeURIComponent(deferredQuery)}` : "/training-paths",
    () => api.trainingPaths.list<TrainingPathListResponse>(params),
  )

  const items = data?.data ?? []

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Training Paths</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">专题训练路径</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            当前已覆盖入门、搜索、动态规划、图论，并补充高级算法和算法面试两条进阶路径。你可以先从免费路径起步，再按专题或阶段继续进阶。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[2rem] border-[3px] border-border bg-card px-5 py-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Search className="size-4 text-primary" />
            搜索路径
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="按路径标题搜索" />
        </div>

        <div className="rounded-[2rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(245,184,167,0.18),rgba(255,241,161,0.18))] px-5 py-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-white/90 px-3 py-1 text-xs font-semibold text-primary">
              <Crown className="size-3.5" />
              统一权限判断
            </div>
            <p className="text-lg font-semibold text-foreground">高级路径按会员或已购商品统一解锁。</p>
            <p className="text-sm leading-7 text-muted-foreground">
              动态规划、图论、高级算法和面试路径适合做专题突破；未解锁时可以先看路径介绍，再选择 VIP 或内容包继续深入。
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <ProductPromoPanel
          badge="训练路径商品"
          title="把专题训练做成可复购商品"
          description="如果你已经确定目标专题，可以直接购买对应内容包或路径商品，解锁完整训练内容。"
          href="/products?type=training_path"
          ctaLabel="查看训练路径商品"
        />
        <ProductPromoPanel
          badge="VIP 会员"
          title="高级路径可直接纳入 VIP"
          description="开通 VIP 后可以继续查看高级路径、题解、视频解析和增强版学习报告。"
          href="/membership"
          ctaLabel="查看会员权益"
        />
        <ProductPromoPanel
          badge="专题训练营"
          title="按主题进营强化训练"
          description="如果你更需要带营期、任务和打卡节奏的高强度训练，可以直接进入专题训练营模块报名。"
          href="/camps"
          ctaLabel="查看训练营"
        />
      </div>

      <section className="mt-12">
        <SectionHeading
          eyebrow="路径列表"
          title="按阶段推进训练"
          description="每条路径都拆成若干章节，并根据你已有的做题记录自动计算完成进度。"
        />

        <div className="mt-6 space-y-5">
          {isLoading ? (
            [...Array.from({ length: 4 })].map((_, index) => (
              <Card key={index} className="bg-background">
                <CardContent className="space-y-4 p-6">
                  <div className="h-6 w-40 rounded-full bg-secondary" />
                  <div className="h-8 w-64 rounded-full bg-secondary" />
                  <div className="h-5 w-full rounded-full bg-secondary" />
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <Card className="bg-background">
              <CardContent className="space-y-3 p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">训练路径加载失败</h2>
                <p className="text-sm leading-7 text-muted-foreground">请稍后重试，或先从题库继续做题。</p>
                <Button asChild variant="secondary">
                  <Link href="/problems">去题库</Link>
                </Button>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card className="bg-background">
              <CardContent className="space-y-3 p-6">
                <div className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border-[3px] border-border bg-card">
                  <BookOpen className="size-6 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">当前没有匹配路径</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {deferredQuery.trim() ? "换个关键词再试，或者直接去题库按标签筛题。" : "稍后再来查看。"}
                </p>
                <Button asChild>
                  <Link href="/problems">去题库选题</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            items.map((item) => <TrainingPathCard key={item.id} item={item} />)
          )}
        </div>
      </section>
    </div>
  )
}
