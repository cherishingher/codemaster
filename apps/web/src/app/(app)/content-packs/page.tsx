"use client"

import Link from "next/link"
import * as React from "react"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, BookOpen, Package2, PlayCircle, Sparkles } from "lucide-react"
import { api } from "@/lib/api-client"
import type { ContentPackListResponse } from "@/lib/content-packs"
import { formatPriceCents, getProductTypeLabel } from "@/lib/products"
import { ProductTagList } from "@/components/products/product-badges"
import { ProductPromoPanel } from "@/components/products/product-promo-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function getTargetTypeLabel(type: string) {
  switch (type) {
    case "training_path":
      return "训练路径"
    case "solution":
      return "高级题解"
    case "video":
      return "视频解析"
    case "problem":
      return "练习题"
    case "problem_set":
      return "专项题单"
    default:
      return type
  }
}

export default function ContentPacksPage() {
  const { data, error, isLoading } = useSWR<ContentPackListResponse>("/content-packs", () =>
    api.contentPacks.list<ContentPackListResponse>(),
  )

  const items = data?.data ?? []

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Content Packs</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">付费内容包</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            面向进阶学习和专项突破的内容包入口。商品、订单、支付和解锁继续复用现有商品中心与统一权限中心，不单独再造一套购买流程。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/products?type=content_pack">
            <ArrowLeft className="size-4" />
            返回商品中心筛选
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProductPromoPanel
          badge="高级路径"
          title="把进阶学习拆成专题内容包"
          description="可以把高级算法、面试准备、动态规划冲刺等内容组织进内容包，用户购买后直接走统一解锁链路。"
          href="/training-paths"
          ctaLabel="查看训练路径"
        />
        <ProductPromoPanel
          badge="训练营"
          title="用内容包做训练营前置预热"
          description="内容包适合做低于训练营客单价的专题预热，训练营则承接更重的营期训练和打卡节奏。"
          href="/camps"
          ctaLabel="查看专题训练营"
        />
        <ProductPromoPanel
          badge="VIP"
          title="高频内容可以直接纳入会员"
          description="如果内容包里的资源本身属于 VIP，可通过统一权限中心让会员用户直接访问。"
          href="/membership"
          ctaLabel="查看会员中心"
        />
      </div>

      <section className="mt-10">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">内容包加载中...</div>
        ) : error ? (
          <Card className="bg-background">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">内容包加载失败</h2>
              <p className="text-sm leading-7 text-muted-foreground">请稍后重试，或先去商品中心查看其他商品。</p>
              <Button asChild variant="secondary">
                <Link href="/products">去商品中心</Link>
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="bg-background">
            <CardContent className="space-y-3 p-6">
              <div className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border-[3px] border-border bg-card">
                <Package2 className="size-6 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">当前还没有已发布内容包</h2>
              <p className="text-sm leading-7 text-muted-foreground">可以先在后台商品中心创建 `content_pack` 商品并配置 includedTargets。</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="bg-background transition-transform hover:-translate-y-0.5">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          {getProductTypeLabel(item.type)}
                        </Badge>
                        <Badge variant="secondary">{item.includedTargetCount} 个内容单元</Badge>
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{item.name}</h2>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {item.summary || item.description || "当前内容包已配置购买和解锁能力。"}
                        </p>
                      </div>
                      <ProductTagList tags={item.tags} />
                    </div>
                    <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4 text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">到手价</p>
                      <p className="mt-1 text-2xl font-semibold text-foreground">
                        {formatPriceCents(item.defaultSku.priceCents, item.defaultSku.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {item.previewTargets.length > 0 ? (
                      item.previewTargets.map((target) => (
                        <div key={`${target.type}:${target.id}`} className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="size-4 text-primary" />
                            <div className="text-sm font-semibold text-foreground">{target.title}</div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">{getTargetTypeLabel(target.type)}</div>
                          {target.summary ? (
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{target.summary}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.3rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                        当前内容包还没有配置 includedTargets。
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/products/${item.id}`}>
                        查看详情并购买
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/training-paths">
                        <BookOpen className="size-4" />
                        去看训练路径
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/learn">
                        <PlayCircle className="size-4" />
                        去看视频学习
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
