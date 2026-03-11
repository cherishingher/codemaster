"use client"

import Link from "next/link"
import { ArrowRight, CalendarRange, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ContestListItem } from "@/lib/contests"
import { formatContestDateRange, getContestRegistrationStatusLabel } from "@/lib/contests"
import { formatPriceCents } from "@/lib/products"

export function ContestCard({ contest }: { contest: ContestListItem }) {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              模拟赛
            </Badge>
            <Badge variant="secondary">{contest.rule}</Badge>
            <Badge variant="outline">{contest.problemCount} 题</Badge>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{contest.name}</h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {contest.summary || "基于现有比赛与题库能力的轻量模拟赛产品。"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.2rem] border-[2px] border-border bg-secondary/35 px-4 py-3">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarRange className="size-4 text-primary" />
              比赛时间
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {formatContestDateRange(contest.startAt, contest.endAt)}
            </p>
          </div>
          <div className="rounded-[1.2rem] border-[2px] border-border bg-secondary/35 px-4 py-3">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="size-4 text-primary" />
              报名情况
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {typeof contest.registrationLimit === "number"
                ? `${contest.registrationCount}/${contest.registrationLimit}`
                : `${contest.registrationCount} 人已报名`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {contest.offer ? (
              <p className="text-2xl font-semibold text-foreground">
                {formatPriceCents(contest.offer.priceCents, contest.offer.currency)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">待配置商品</p>
            )}
            {contest.registration ? (
              <p className="mt-1 text-xs text-muted-foreground">
                我的状态：{getContestRegistrationStatusLabel(contest.registration.status)}
              </p>
            ) : null}
          </div>
          <Button asChild>
            <Link href={`/contests/${contest.slug}`}>
              查看模拟赛
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
