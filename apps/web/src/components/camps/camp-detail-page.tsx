"use client"

import Link from "next/link"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { ArrowLeft, ArrowRight, CalendarRange, Clock3, Trophy, Users } from "lucide-react"
import { api } from "@/lib/api-client"
import type { CampDetailResponse } from "@/lib/camps"
import {
  formatCampDateRange,
  getCampClassStatusLabel,
  getCampEnrollmentStatusLabel,
} from "@/lib/camps"
import { formatPriceCents } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function CampDetailPage() {
  const params = useParams()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const { data, error, isLoading } = useSWR<CampDetailResponse>(
    id ? `/camps/${id}` : null,
    () => api.camps.get<CampDetailResponse>(id as string),
  )

  const camp = data?.data

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          训练营不存在或尚未开放。
        </div>
      </div>
    )
  }

  if (isLoading || !camp) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">训练营详情加载中...</div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href="/camps">
            <ArrowLeft className="size-4" />
            返回训练营列表
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  训练营
                </Badge>
                {camp.difficulty ? <Badge variant="secondary">{camp.difficulty}</Badge> : null}
                <Badge variant="outline">{camp.classCount} 个班级</Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">{camp.title}</h1>
                <p className="text-base leading-8 text-muted-foreground">
                  {camp.description || camp.summary || "当前训练营还没有补充完整描述。"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">适合人群</p>
                <p className="mt-2 text-base font-semibold text-foreground">{camp.suitableFor || "有阶段目标的学生"}</p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">最近开营</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {camp.nextStartAt ? new Date(camp.nextStartAt).toLocaleDateString("zh-CN") : "待定"}
                </p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">起售价</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {camp.priceFrom ? formatPriceCents(camp.priceFrom.priceCents, camp.priceFrom.currency) : "待配置"}
                </p>
              </div>
            </div>

            {camp.highlights.length ? (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground">训练营亮点</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {camp.highlights.map((item) => (
                    <div key={item} className="rounded-[1.2rem] border-[2px] border-border bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-7">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">报名与入营</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                训练营继续复用一期商品和订单链路，点击报名会直接进入现有结算页与 mock 支付流程。
              </p>
            </div>

            {camp.myEnrollment ? (
              <div className="rounded-[1.4rem] border-[3px] border-primary/30 bg-primary/10 px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">我的报名状态</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {getCampEnrollmentStatusLabel(camp.myEnrollment.status)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{camp.myEnrollment.classTitle}</p>
                  </div>
                  <Button asChild>
                    <Link href={`/camp-class/${camp.myEnrollment.classId}`}>
                      进入班级
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {camp.classes.map((campClass) => {
                const offer = campClass.defaultOffer ?? campClass.offers[0] ?? null
                const checkoutHref =
                  offer ? `/checkout?productId=${encodeURIComponent(offer.productId)}&skuId=${encodeURIComponent(offer.skuId)}` : null

                return (
                  <div key={campClass.id} className="rounded-[1.5rem] border-[3px] border-border bg-card px-5 py-5">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-foreground">{campClass.title}</p>
                            <Badge variant="secondary">{getCampClassStatusLabel(campClass.status)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{campClass.summary || "当前班级暂无补充说明。"}</p>
                        </div>
                        <div className="text-right">
                          {offer ? (
                            <p className="text-2xl font-semibold text-foreground">
                              {formatPriceCents(offer.priceCents, offer.currency)}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">待配置价格</p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          <div className="inline-flex items-center gap-2 font-medium text-foreground">
                            <CalendarRange className="size-4 text-primary" />
                            开营时间
                          </div>
                          <p className="mt-2">{formatCampDateRange(campClass.startAt, campClass.endAt)}</p>
                        </div>
                        <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          <div className="inline-flex items-center gap-2 font-medium text-foreground">
                            <Users className="size-4 text-primary" />
                            名额情况
                          </div>
                          <p className="mt-2">
                            {campClass.capacity ? `${campClass.occupiedSeats}/${campClass.capacity}` : "不限人数"}
                          </p>
                        </div>
                        <div className="rounded-[1.1rem] border-[2px] border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          <div className="inline-flex items-center gap-2 font-medium text-foreground">
                            <Clock3 className="size-4 text-primary" />
                            带你完成
                          </div>
                          <p className="mt-2">每日任务、打卡、排行榜、结营报告</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {camp.myEnrollment?.classId === campClass.id ? (
                          <Button asChild>
                            <Link href={`/camp-class/${campClass.id}`}>
                              进入班级
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        ) : checkoutHref ? (
                          <Button asChild disabled={campClass.isFull}>
                            <Link href={checkoutHref}>
                              {campClass.isFull ? "名额已满" : "立即报名"}
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button disabled>待配置商品</Button>
                        )}

                        <Button asChild variant="secondary">
                          <Link href={`/camp-class/${campClass.id}`}>
                            查看班级页
                            <Trophy className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
