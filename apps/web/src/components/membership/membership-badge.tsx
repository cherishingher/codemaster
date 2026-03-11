"use client"

import { Crown } from "lucide-react"
import type { MembershipStatus } from "@/lib/membership"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MembershipBadgeProps = {
  status: MembershipStatus
  tier?: string
  compact?: boolean
  className?: string
}

function getBadgeMeta(status: MembershipStatus) {
  switch (status) {
    case "ACTIVE":
      return {
        label: "生效中",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      }
    case "EXPIRED":
      return {
        label: "已过期",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      }
    default:
      return {
        label: "未开通",
        className: "border-border bg-secondary text-muted-foreground",
      }
  }
}

export function MembershipBadge({
  status,
  tier = "VIP",
  compact = false,
  className,
}: MembershipBadgeProps) {
  const meta = getBadgeMeta(status)

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border px-3 py-1 font-medium",
        meta.className,
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <Crown className={compact ? "size-3.5" : "size-4"} />
      {tier} {meta.label}
    </Badge>
  )
}
