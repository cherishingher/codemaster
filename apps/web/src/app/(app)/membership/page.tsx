"use client"

import Link from "next/link"
import { ArrowRight, Crown, Layers3, ReceiptText, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { type MembershipSubscriptionView, formatMembershipDate } from "@/lib/membership"
import { useMembership, useMembershipBenefits } from "@/lib/hooks/use-membership"
import { formatPriceCents } from "@/lib/products"
import { MembershipBadge } from "@/components/membership/membership-badge"
import { MembershipStatusCard } from "@/components/membership/membership-status-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const guestMembership: MembershipSubscriptionView = {
  tier: "VIP",
  status: "NONE",
  isActive: false,
  sourceType: "none",
  startedAt: null,
  expiresAt: null,
  remainingDays: 0,
  renewsFrom: "now",
  productId: null,
  productName: null,
  skuId: null,
  skuName: null,
  activeBenefits: [],
}

export default function MembershipPage() {
  const { loggedIn, loading } = useAuth()
  const { membership, isLoading: membershipLoading } = useMembership(loggedIn)
  const { benefits, isLoading: benefitsLoading } = useMembershipBenefits()

  if (loading || benefitsLoading || (loggedIn && membershipLoading)) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">会员信息加载中...</div>
  }

  const membershipData = membership ?? guestMembership
  const product = benefits?.product ?? null
  const renewHref =
    product?.defaultSku
      ? `/checkout?productId=${encodeURIComponent(product.id)}&skuId=${encodeURIComponent(product.defaultSku.id)}`
      : "/products?type=membership"

  return (
    <div className="page-wrap py-10 md:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-7 p-7 md:p-10">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              <Crown className="size-4" />
              VIP 会员中心
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                用一套 VIP 会员
                <span className="text-primary"> 串起题解、视频、训练路径和学习报告</span>
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                一期只做单层 VIP。购买后自动接入现有订单与支付闭环，支付成功即生效，到期自动失效，续费按当前 endAt 顺延。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">当前状态</p>
                <div className="mt-3">
                  <MembershipBadge status={membershipData.status} tier={membershipData.tier} />
                </div>
              </div>
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">到期时间</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {formatMembershipDate(membershipData.expiresAt)}
                </p>
              </div>
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">已生效权益</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{membershipData.activeBenefits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">VIP Benefits</p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">核心权益</h2>
              </div>
              <MembershipBadge status={membershipData.status} tier="VIP" />
            </div>

            <div className="grid gap-3">
              {(benefits?.benefits ?? []).map((benefit) => (
                <div key={benefit.key} className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 size-4 text-primary" />
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">{benefit.title}</p>
                      <p className="text-sm leading-7 text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={loggedIn ? renewHref : "/login"}>
                  {membershipData.isActive ? "立即续费" : "开通 VIP"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/membership/benefits">权益说明</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <MembershipStatusCard
          membership={membershipData}
          renewHref={renewHref}
          isLoggedIn={loggedIn}
        />
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_0.96fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Renew Plans</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">开通与续费规格</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                月卡、季卡、年卡都走现有商品与订单链路。当前已生效时续费按到期顺延，已过期时从当前时间开始。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {product?.skus.map((sku) => (
                <div key={sku.id} className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">{sku.name}</p>
                      {sku.description ? (
                        <p className="text-sm leading-7 text-muted-foreground">{sku.description}</p>
                      ) : null}
                    </div>
                    {sku.isDefault ? <Badge className="bg-primary/15 text-primary">推荐规格</Badge> : null}
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <p className="text-3xl font-semibold text-foreground">
                      {formatPriceCents(sku.priceCents, sku.currency)}
                    </p>
                    {sku.originalPriceCents != null ? (
                      <p className="text-sm text-muted-foreground line-through">
                        {formatPriceCents(sku.originalPriceCents, sku.currency)}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    有效期 {sku.validDays ?? product.defaultSku.validDays ?? 0} 天
                  </div>

                  <Button asChild className="mt-5 w-full">
                    <Link
                      href={
                        loggedIn
                          ? `/checkout?productId=${encodeURIComponent(product.id)}&skuId=${encodeURIComponent(sku.id)}`
                          : "/login"
                      }
                    >
                      {membershipData.isActive ? "续费该规格" : "选择该规格"}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <Layers3 className="mt-1 size-5 text-primary" />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">会员规则</h2>
                  <div className="mt-2 space-y-3 text-sm leading-7 text-muted-foreground">
                    <p>单层会员：一期只做 VIP，不引入更复杂的等级体系。</p>
                    <p>自动生效：订单支付成功后自动写入会员订阅与权益，不需要额外手动开通。</p>
                    <p>自动失效：到期后状态自动转为已过期，页面刷新后展示始终以当前状态为准。</p>
                    <p>统一读取：题解、视频、训练路径和学习报告后续都基于同一份会员状态判断。</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <ReceiptText className="mt-1 size-5 text-primary" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">继续操作</h2>
                  <p className="text-sm leading-7 text-muted-foreground">
                    会员商品仍然是标准商品，后续订单、支付、退款都继续复用同一套交易链路。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/products?type=membership">会员商品</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={loggedIn ? "/me/orders" : "/login"}>我的订单</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={loggedIn ? "/me/assets" : "/login"}>我的资产</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
