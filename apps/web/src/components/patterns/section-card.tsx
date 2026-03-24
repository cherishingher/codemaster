import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SectionCardProps = {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn("surface-panel overflow-hidden rounded-[1.9rem]", className)}>
      <CardHeader className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,241,161,0.22))]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("p-6 md:p-7", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
