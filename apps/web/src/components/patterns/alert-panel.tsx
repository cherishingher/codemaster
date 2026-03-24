import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertPanelProps = {
  title: string
  description: string
  icon?: LucideIcon
  tone?: "default" | "info" | "warning" | "danger" | "success"
  action?: React.ReactNode
  className?: string
}

const toneClasses: Record<NonNullable<AlertPanelProps["tone"]>, string> = {
  default: "border-border bg-card text-foreground",
  info: "border-sky-300/60 bg-sky-50/85 text-sky-900",
  warning: "border-amber-300/60 bg-amber-50/90 text-amber-900",
  danger: "border-rose-300/60 bg-rose-50/90 text-rose-900",
  success: "border-emerald-300/60 bg-emerald-50/90 text-emerald-900",
}

export function AlertPanel({
  title,
  description,
  icon: Icon,
  tone = "default",
  action,
  className,
}: AlertPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border-[2px] px-4 py-4 shadow-[var(--shadow-sm)]",
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[1rem] border border-current/15 bg-white/70">
              <Icon className="size-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-7 opacity-80">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}
