"use client"

import Link from "next/link"
import { ArrowRight, CalendarRange, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CampListItem } from "@/lib/camps"
import { formatCampDateRange, getCampClassStatusLabel } from "@/lib/camps"
import { formatPriceCents } from "@/lib/products"

export function CampCard({ camp }: { camp: CampListItem }) {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              训练营
            </Badge>
            {camp.difficulty ? <Badge variant="secondary">{camp.difficulty}</Badge> : null}
            <Badge variant="outline">{camp.activeClassCount} 个开班中</Badge>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{camp.title}</h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {camp.summary || "基于现有题库、路径和题解能力组织出的阶段性训练营。"}
            </p>
          </div>
        </div>

        {camp.defaultOffer ? (
          <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
            <div className="text-sm text-muted-foreground">起售价</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {formatPriceCents(camp.defaultOffer.priceCents, camp.defaultOffer.currency)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                余位 {camp.defaultOffer.availableSeats ?? "不限"}
              </span>
              {camp.nextStartAt ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarRange className="size-3.5" />
                  最近开营 {new Date(camp.nextStartAt).toLocaleDateString("zh-CN")}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {camp.classes.slice(0, 2).map((campClass) => (
            <div key={campClass.id} className="rounded-[1.1rem] border-[2px] border-border bg-secondary/35 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{campClass.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCampDateRange(campClass.startAt, campClass.endAt)}
                  </p>
                </div>
                <Badge variant="secondary">{getCampClassStatusLabel(campClass.status)}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/camps/${camp.slug}`}>
              查看训练营
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {camp.myEnrollment ? (
            <Button asChild variant="secondary">
              <Link href={`/camp-class/${camp.myEnrollment.classId}`}>进入我的班级</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
