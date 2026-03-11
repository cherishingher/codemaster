"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarRange, Loader2, Sparkles, Target } from "lucide-react"
import { api } from "@/lib/api-client"
import type { AiLearningPlanResponse } from "@/lib/ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const GOAL_PRESETS = [
  "两周内补强动态规划并提升通过率",
  "把最近错题复盘做扎实，减少重复失误",
  "继续当前训练路径，同时把做题节奏稳定到每周 3 天",
]

export function AiLearningPlanCard({
  defaultGoal = "提升最近一周的训练效率并继续当前路径",
}: {
  defaultGoal?: string
}) {
  const [goal, setGoal] = React.useState(defaultGoal)
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<AiLearningPlanResponse["data"] | null>(null)

  const handleGenerate = React.useCallback(
    async (nextGoal?: string) => {
      const targetGoal = (nextGoal ?? goal).trim()
      if (!targetGoal) {
        toast.error("请先输入一个学习目标")
        return
      }

      setLoading(true)
      try {
        const response = await api.ai.plan<AiLearningPlanResponse>({
          goal: targetGoal,
          days: 7,
        })
        setData(response.data)
        setGoal(targetGoal)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "学习计划生成失败")
      } finally {
        setLoading(false)
      }
    },
    [goal],
  )

  React.useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setLoading(true)
      try {
        const response = await api.ai.plan<AiLearningPlanResponse>({
          goal: defaultGoal,
          days: 7,
        })
        if (!cancelled) {
          setData(response.data)
          setGoal(defaultGoal)
        }
      } catch {
        if (!cancelled) {
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [defaultGoal])

  return (
    <Card className="bg-background">
      <CardContent className="space-y-5 p-6 md:p-7">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CalendarRange className="size-3.5" />
            AI Planner
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">个性化学习计划</h3>
          <p className="text-sm leading-7 text-muted-foreground">
            输入你的目标，系统会结合最近的训练数据，自动生成一份 7 天学习安排，并给出动态调整建议。
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={3}
            className="w-full rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50"
            placeholder="例如：两周内补强动态规划并提升通过率"
          />
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((item) => (
              <Button key={item} type="button" variant="secondary" onClick={() => void handleGenerate(item)}>
                {item}
              </Button>
            ))}
          </div>
          <Button type="button" onClick={() => void handleGenerate()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            生成计划
          </Button>
        </div>

        {data ? (
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
              <p className="text-sm leading-7 text-muted-foreground">{data.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.focusTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    <Target className="mr-1 size-3.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {data.plan.map((day) => (
                <div
                  key={day.day}
                  className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">Day {day.day} · {day.focus}</h4>
                      <p className="text-sm text-muted-foreground">预计 {day.estimatedMinutes} 分钟</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    {day.tasks.map((task) => (
                      <div key={task.id} className="rounded-[1rem] border border-border/70 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{task.title}</p>
                            <p className="mt-1 text-sm leading-7 text-muted-foreground">{task.description}</p>
                          </div>
                          <Badge variant="secondary">{task.estimatedMinutes} 分钟</Badge>
                        </div>
                        {task.href ? (
                          <div className="mt-3">
                            <Button asChild variant={task.locked ? "secondary" : "outline"} size="sm">
                              <Link href={task.locked ? "/products" : task.href}>
                                {task.locked ? "查看解锁" : "打开任务"}
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {data.adjustments.length > 0 ? (
              <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                <h4 className="text-lg font-semibold text-foreground">动态调整建议</h4>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                  {data.adjustments.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
