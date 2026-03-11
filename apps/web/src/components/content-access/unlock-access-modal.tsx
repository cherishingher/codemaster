"use client"

import * as React from "react"
import { Crown, Lock, X } from "lucide-react"
import { formatContentAccessRequirement, type ContentAccessResult } from "@/lib/content-access"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RecommendedProductsList } from "@/components/content-access/recommended-products-list"

export function UnlockAccessModal({
  access,
  triggerLabel = "查看解锁方式",
  className,
}: {
  access: ContentAccessResult
  triggerLabel?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const requiredLabel = formatContentAccessRequirement(access.policy.requiredSources)

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className={className}>
        <Crown className="size-4" />
        {triggerLabel}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-8"
          onClick={() => setOpen(false)}
        >
          <div
            className={cn(
              "w-full max-w-3xl rounded-[2rem] border-[3px] border-border bg-background shadow-[12px_12px_0_hsl(var(--border))]",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b-[3px] border-border px-6 py-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Unlock Resource</p>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">解锁当前内容</h3>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{access.message}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="flex items-center gap-3 rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                <div className="inline-flex size-10 items-center justify-center rounded-[1rem] border-[2px] border-border bg-background">
                  <Lock className="size-4 text-primary" />
                </div>
                <p>
                  权限要求：{requiredLabel}
                  {access.userSummary.membership?.expiresAt
                    ? `，你的 VIP 当前有效至 ${new Date(access.userSummary.membership.expiresAt).toLocaleDateString("zh-CN")}`
                    : ""}
                </p>
              </div>

              <RecommendedProductsList
                products={access.recommendedProducts}
                loggedIn={access.userSummary.isLoggedIn}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
