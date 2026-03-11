"use client"

import {
  AlertTriangle,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  getLearningRiskClass,
  getLearningRiskLabel,
  type PersonalizedLearningAnalyticsPayload,
} from "@/lib/learning-analytics"
import { formatReportRate } from "@/lib/learning-reports"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ProgressBar } from "@/components/training-paths/progress-bar"

export function PersonalizedLearningInsightsCard({
  data,
  loading,
}: {
  data: PersonalizedLearningAnalyticsPayload | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="bg-background">
        <CardContent className="p-6 text-sm text-muted-foreground">个性化分析生成中...</CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="bg-background">
        <CardContent className="p-6 text-sm text-muted-foreground">当前暂时无法生成个性化学习分析。</CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Personalized Insights
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">个性化学习分析</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              基于最近 {data.window.days} 天的提交、通过、标签和路径进度，自动识别优势、瓶颈与下阶段建议。
            </p>
          </div>
          <Badge className={getLearningRiskClass(data.prediction.level)}>
            {getLearningRiskLabel(data.prediction.level)} · 风险分 {data.prediction.score}
          </Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                {data.trendSignal.direction === "down" ? (
                  <TrendingDown className="size-4 text-rose-600" />
                ) : (
                  <TrendingUp className="size-4 text-emerald-600" />
                )}
                趋势判断
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{data.trendSignal.summary}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                <div>
                  最近阶段平均提交 <span className="font-semibold text-foreground">{data.trendSignal.recentAverageSubmissions}</span>
                </div>
                <div>
                  最近阶段通过率 <span className="font-semibold text-foreground">{formatReportRate(data.trendSignal.recentAcceptedRate)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" />
                当前优势
              </div>
              <div className="space-y-2">
                {data.strengths.length === 0 ? (
                  <p className="text-sm text-muted-foreground">当前优势还不够稳定，建议先把训练节奏拉齐。</p>
                ) : (
                  data.strengths.map((item, index) => (
                    <div key={index} className="rounded-[1rem] border border-border/60 bg-background px-3 py-3 text-sm text-muted-foreground">
                      {item}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 text-amber-600" />
                预测瓶颈
              </div>
              <p className="mb-4 text-sm leading-7 text-muted-foreground">{data.prediction.summary}</p>
              <div className="space-y-3">
                {data.bottlenecks.length === 0 ? (
                  <div className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-sm text-emerald-700">
                    当前没有明显瓶颈信号，可以继续沿现有路径推进。
                  </div>
                ) : (
                  data.bottlenecks.map((item) => (
                    <div key={item.key} className="rounded-[1rem] border border-border/60 bg-background px-3 py-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-foreground">{item.title}</div>
                        <Badge className={getLearningRiskClass(item.severity)}>{getLearningRiskLabel(item.severity)}</Badge>
                      </div>
                      <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-3 text-sm font-semibold text-foreground">薄弱标签与关注路径</div>
              <div className="space-y-3">
                {data.weakTags.map((tag) => (
                  <div key={tag.tag}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{tag.tag}</span>
                      <span className="text-muted-foreground">{formatReportRate(tag.completionRate)}</span>
                    </div>
                    <ProgressBar value={tag.completionRate} />
                  </div>
                ))}
              </div>
              {data.focusPaths.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.focusPaths.map((path) => (
                    <Badge key={path.id} variant="secondary">
                      {path.title}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-3 text-sm font-semibold text-foreground">建议动作</div>
              <div className="space-y-2">
                {data.actionableSuggestions.map((item, index) => (
                  <div key={index} className="rounded-[1rem] border border-border/60 bg-background px-3 py-3 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
