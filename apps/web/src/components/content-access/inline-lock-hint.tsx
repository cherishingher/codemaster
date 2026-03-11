"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import type { ContentAccessResult } from "@/lib/content-access"
import { Button } from "@/components/ui/button"
import { RecommendedProductsList } from "@/components/content-access/recommended-products-list"
import { UnlockAccessModal } from "@/components/content-access/unlock-access-modal"

export function InlineLockHint({
  access,
  label = "未解锁",
  showRecommendations = true,
}: {
  access: ContentAccessResult
  label?: string
  showRecommendations?: boolean
}) {
  return (
    <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="size-3.5 text-primary" />
              {label}
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{access.message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <UnlockAccessModal access={access} triggerLabel="解锁方案" />
            <Button asChild variant="secondary">
              <Link href="/products">去商品中心</Link>
            </Button>
          </div>
        </div>

        {showRecommendations && access.recommendedProducts.length > 0 ? (
          <RecommendedProductsList
            products={access.recommendedProducts.slice(0, 2)}
            loggedIn={access.userSummary.isLoggedIn}
          />
        ) : null}
      </div>
    </div>
  )
}
