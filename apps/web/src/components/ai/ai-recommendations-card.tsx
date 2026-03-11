"use client"

import Link from "next/link"
import useSWR from "swr"
import { Compass, Lock, Route, Sparkles, Target } from "lucide-react"
import { api } from "@/lib/api-client"
import type { AiRecommendationsResponse } from "@/lib/ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function getResourceLabel(type: string) {
  switch (type) {
    case "training_path":
      return "训练路径"
    case "problem":
      return "题目"
    case "solution":
      return "题解"
    case "video":
      return "视频"
    default:
      return type
  }
}

export function AiRecommendationsCard() {
  const { data, error, isLoading } = useSWR<AiRecommendationsResponse>("/ai/recommendations", () =>
    api.ai.recommendations<AiRecommendationsResponse>(),
  )

  if (isLoading) {
    return (
      <Card className="bg-background">
        <CardContent className="p-6 text-sm text-muted-foreground">AI 推荐生成中...</CardContent>
      </Card>
    )
  }

  if (error || !data?.data) {
    return (
      <Card className="bg-background">
        <CardContent className="space-y-2 p-6">
          <h3 className="text-xl font-semibold text-foreground">AI 学习推荐</h3>
          <p className="text-sm text-muted-foreground">当前无法生成个性化推荐，请稍后重试。</p>
        </CardContent>
      </Card>
    )
  }

  const payload = data.data

  return (
    <Card className="bg-background">
      <CardContent className="space-y-5 p-6 md:p-7">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            AI Recommendation
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">智能推荐学习内容</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            结合你最近的做题进度、错题标签和路径推进情况，优先推荐现在最适合接上的内容。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {payload.profile.weakTags.slice(0, 3).map((item) => (
            <Badge key={item.tag} variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              <Target className="mr-1 size-3.5" />
              {item.tag}
            </Badge>
          ))}
          {payload.profile.activePathTitles.slice(0, 1).map((item) => (
            <Badge key={item} variant="secondary">
              <Route className="mr-1 size-3.5" />
              {item}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {payload.items.map((item) => (
            <div
              key={`${item.resourceType}:${item.id}`}
              className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{getResourceLabel(item.resourceType)}</Badge>
                    {item.locked ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        <Lock className="mr-1 size-3.5" />
                        {item.requiredSources.join(" / ")}
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm leading-7 text-muted-foreground">{item.summary}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.reason}</p>
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button asChild variant={item.locked ? "secondary" : "default"}>
                  <Link href={item.locked ? "/products" : item.href}>
                    {item.locked ? "查看解锁" : "开始学习"}
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button asChild variant="secondary">
            <Link href="/ai">
              <Compass className="size-4" />
              打开 AI 辅导台
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

