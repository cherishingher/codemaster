import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/training-paths/progress-bar"

type ProgressBlockProps = {
  title: string
  subtitle?: string
  valueLabel?: string
  progress: number
  footer?: React.ReactNode
  badge?: React.ReactNode
}

export function ProgressBlock({
  title,
  subtitle,
  valueLabel,
  progress,
  footer,
  badge,
}: ProgressBlockProps) {
  return (
    <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-4 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {badge ?? (valueLabel ? <Badge variant="secondary">{valueLabel}</Badge> : null)}
      </div>
      <ProgressBar value={progress} />
      {footer ? <div className="mt-3 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  )
}
