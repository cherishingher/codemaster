"use client"

import Link from "next/link"
import { CalendarClock, Crown, RefreshCcw, ShieldCheck } from "lucide-react"
import type { MembershipSubscriptionView } from "@/lib/membership"
import { formatMembershipDate } from "@/lib/membership"
import { MembershipBadge } from "@/components/membership/membership-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type MembershipStatusCardProps = {
  membership: MembershipSubscriptionView
  renewHref: string
  loginHref?: string
  benefitsHref?: string
  isLoggedIn?: boolean
}

export function MembershipStatusCard({
  membership,
  renewHref,
  loginHref = "/login",
  benefitsHref = "/membership/benefits",
  isLoggedIn = true,
}: MembershipStatusCardProps) {
  const actionHref = isLoggedIn ? renewHref : loginHref
  const actionLabel = membership.isActive ? "立即续费" : isLoggedIn ? "开通 VIP" : "登录后开通"

  return (
    <Card className="overflow-hidden bg-background">
      <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(255,241,161,0.22),rgba(245,184,167,0.18))] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
              <Crown className="size-3.5 text-primary" />
              Membership
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">当前会员状态</h2>
          </div>
          <MembershipBadge status={membership.status} tier={membership.tier} />
        </div>
      </div>

      <CardContent className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">会员等级</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{membership.tier}</p>
          </div>
          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">到期时间</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatMembershipDate(membership.expiresAt)}</p>
          </div>
          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">剩余天数</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{membership.remainingDays}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border-[2px] border-border bg-card px-5 py-5">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">生效与到期规则</p>
              <p className="text-sm leading-7 text-muted-foreground">
                {membership.isActive
                  ? `当前会员有效至 ${formatMembershipDate(membership.expiresAt)}，新的续费会从当前到期时间顺延。`
                  : "当前没有有效会员，下一次购买会从支付成功时间开始生效。"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <RefreshCcw className="mt-0.5 size-5 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">续费策略</p>
              <p className="text-sm leading-7 text-muted-foreground">
                {membership.renewsFrom === "current_end"
                  ? "续费按当前 endAt 顺延，不会损失已生效的剩余时长。"
                  : "已过期后再次购买，将从当前时间重新开始计算有效期。"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">当前规格</p>
              <p className="text-sm leading-7 text-muted-foreground">
                {membership.productName
                  ? `${membership.productName}${membership.skuName ? ` · ${membership.skuName}` : ""}`
                  : "尚未绑定具体会员订单"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border-[2px] border-border bg-card px-5 py-5">
          <p className="text-sm font-semibold text-foreground">当前已生效权益</p>
          {membership.activeBenefits.length > 0 ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {membership.activeBenefits.map((benefit) => (
                <div key={benefit.key} className="rounded-[1rem] border border-border/70 bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {membership.status === "EXPIRED"
                ? "会员已到期，相关会员权益已自动失效。续费后会立即恢复。"
                : "当前还没有生效中的会员权益，开通后即可解锁高级题解、视频解析、高级训练路径与增强版学习报告。"}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={benefitsHref}>查看权益说明</Link>
          </Button>
          {isLoggedIn ? (
            <Button asChild variant="secondary">
              <Link href="/me/orders">我的订单</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
