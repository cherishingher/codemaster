import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  children: React.ReactNode
  tone?: "success" | "warning" | "danger" | "info" | "muted"
  className?: string
}

const toneClasses: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-700",
  warning: "border-amber-400/50 bg-amber-500/10 text-amber-700",
  danger: "border-red-400/40 bg-red-500/10 text-red-700",
  info: "border-sky-400/40 bg-sky-500/10 text-sky-700",
  muted: "border-border/70 bg-background text-muted-foreground",
}

export function StatusBadge({ children, tone = "muted", className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(toneClasses[tone], className)}>
      {children}
    </Badge>
  )
}
