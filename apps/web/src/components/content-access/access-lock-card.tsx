"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Lock, ShieldCheck } from "lucide-react"
import { formatContentAccessRequirement, type ContentAccessResult } from "@/lib/content-access"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UnlockAccessModal } from "@/components/content-access/unlock-access-modal"

export function AccessLockCard({
  access,
  title,
  description,
  preview,
  compact = false,
}: {
  access: ContentAccessResult
  title: string
  description?: string
  preview?: ReactNode
  compact?: boolean
}) {
  const requiredLabel = formatContentAccessRequirement(access.policy.requiredSources)
  const secondaryHref = access.userSummary.isLoggedIn ? "/products" : "/login"
  const secondaryLabel = access.userSummary.isLoggedIn ? "进入商品中心" : "登录后解锁"
  const showExtraUnlockHint =
    access.userSummary.hasActiveMembership &&
    !access.policy.requiredSources.includes("MEMBERSHIP") &&
    access.reasonCode !== "LOGIN_REQUIRED"

  return (
    <div className="rounded-[1.9rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(245,184,167,0.18),rgba(255,241,161,0.18))] px-6 py-8">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border-[3px] border-border bg-card">
            <Lock className="size-6 text-primary" />
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            {requiredLabel}
          </Badge>
          {showExtraUnlockHint ? (
            <Badge variant="secondary">
              <ShieldCheck className="mr-1 size-3.5" />
              已有 VIP，当前资源仍需额外解锁
            </Badge>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description ?? access.message}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <UnlockAccessModal access={access} triggerLabel="查看解锁方案" />
          <Button asChild variant="secondary">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </div>

        {preview ? (
          <div className={compact ? "" : "rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4"}>
            {preview}
          </div>
        ) : null}
      </div>
    </div>
  )
}
