import * as React from "react"
import { cn } from "@/lib/utils"

type HeatmapPoint = {
  date: string
  submissions: number
  accepted?: number
}

type HeatmapCardProps = {
  title?: string
  description?: string
  points: HeatmapPoint[]
}

function getToneClass(intensity: number) {
  if (intensity >= 0.85) return "bg-primary"
  if (intensity >= 0.6) return "bg-primary/80"
  if (intensity >= 0.35) return "bg-primary/55"
  if (intensity > 0) return "bg-primary/25"
  return "bg-muted"
}

export function HeatmapCard({
  title = "学习热力",
  description = "按天查看最近一周的训练密度和通过情况。",
  points,
}: HeatmapCardProps) {
  const max = Math.max(1, ...points.map((item) => item.submissions))

  return (
    <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
      <div className="mb-4">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {points.map((point) => {
          const intensity = point.submissions / max
          const rate = point.submissions > 0 ? Math.round(((point.accepted ?? 0) / point.submissions) * 100) : 0
          return (
            <div key={point.date} className="space-y-2">
              <div
                className={cn(
                  "flex aspect-square items-end rounded-[1rem] border-[2px] border-border px-2 py-2",
                  getToneClass(intensity),
                )}
                title={`${point.date} · 提交 ${point.submissions} · 通过率 ${rate}%`}
              >
                <span className="text-[11px] font-semibold text-foreground">{point.submissions}</span>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-muted-foreground">{point.date.slice(5)}</p>
                <p className="text-[11px] font-medium text-foreground">{rate}%</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
