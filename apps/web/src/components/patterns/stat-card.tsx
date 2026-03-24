import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: "primary" | "secondary" | "accent" | "warning"
  className?: string
}

const toneMap: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/25",
  secondary: "bg-secondary/65",
  accent: "bg-accent/70",
  warning: "bg-[hsl(48_86%_78%)]",
}

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("surface-panel rounded-[1.8rem]", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <div className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{value}</div>
          {description ? <div className="text-sm leading-6 text-muted-foreground">{description}</div> : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-[1.2rem] border-[3px] border-border p-3 text-foreground", toneMap[tone])}>
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
