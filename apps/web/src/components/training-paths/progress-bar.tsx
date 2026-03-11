"use client"

import { cn } from "@/lib/utils"

export function ProgressBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)))

  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
