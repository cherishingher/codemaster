"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, BarChart3, BookOpenText, Crown, MonitorPlay, Route } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { useMembership, useMembershipBenefits } from "@/lib/hooks/use-membership"
import { formatPriceCents } from "@/lib/products"
import { MembershipBadge } from "@/components/membership/membership-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const benefitIcons = {
  advanced_solutions: BookOpenText,
  video_analysis: MonitorPlay,
  advanced_training_paths: Route,
  enhanced_learning_reports: BarChart3,
} as const

export default function MembershipBenefitsPage() {
  const { loggedIn } = useAuth()
  const { membership } = useMembership(loggedIn)
  const { benefits, isLoading } = useMembershipBenefits()

  if (isLoading || !benefits) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">权益说明加载中...</div>
  }

  const renewHref =
    benefits.product?.defaultSku
      ? `/checkout?productId=${encodeURIComponent(benefits.product.id)}&skuId=${encodeURIComponent(
          benefits.product.defaultSku.id,
        )}`
      : "/products?type=membership"
  const membershipProduct = benefits.product

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Membership Benefits</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">VIP 权益说明</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            一期只保留最能验证付费闭环的四项核心权益，全部复用现有题库、视频、训练路径和学习报告模型。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/membership">
              <ArrowLeft className="size-4" />
              返回会员中心
            </Link>
          </Button>
          {membership ? <MembershipBadge status={membership.status} tier={membership.tier} /> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {benefits.benefits.map((benefit) => {
          const Icon = benefitIcons[benefit.key]
          return (
            <Card key={benefit.key} className="overflow-hidden bg-background">
              <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(141,194,245,0.18),rgba(255,241,161,0.2))] px-6 py-5">
                <div className="inline-flex size-12 items-center justify-center rounded-[1rem] border-[3px] border-border bg-card">
                  <Icon className="size-5 text-primary" />
                </div>
              </div>
              <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">{benefit.title}</h2>
                  <p className="text-sm leading-7 text-muted-foreground">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-8 overflow-hidden bg-background">
        <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(103,197,89,0.18),rgba(245,184,167,0.18))] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">VIP SKU</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {benefits.product?.name ?? "VIP 会员"}
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2 text-sm text-muted-foreground">
              <Crown className="size-4 text-primary" />
              继续走统一商品与订单链路
            </div>
          </div>
        </div>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          {membershipProduct?.skus.map((sku) => (
            <div key={sku.id} className="rounded-[1.4rem] border-[2px] border-border bg-card px-5 py-5">
              <p className="text-lg font-semibold text-foreground">{sku.name}</p>
              {sku.description ? (
                <p className="mt-1 text-sm leading-7 text-muted-foreground">{sku.description}</p>
              ) : null}
              <p className="mt-4 text-3xl font-semibold text-foreground">
                {formatPriceCents(sku.priceCents, sku.currency)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">有效期 {sku.validDays ?? 0} 天</p>
              <Button asChild className="mt-4 w-full">
                <Link
                  href={
                    loggedIn
                      ? `/checkout?productId=${encodeURIComponent(membershipProduct.id)}&skuId=${encodeURIComponent(sku.id)}`
                      : "/login"
                  }
                >
                  去结算
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={loggedIn ? renewHref : "/login"}>
            {membership?.isActive ? "续费 VIP" : "开通 VIP"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/products?type=membership">查看会员商品</Link>
        </Button>
      </div>
    </div>
  )
}
