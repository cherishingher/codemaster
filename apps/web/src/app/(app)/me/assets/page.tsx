"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, CheckCircle2, Clock3, Package2 } from "lucide-react"
import { api } from "@/lib/api-client"
import type { UserAssetsResponse } from "@/lib/products"
import { formatPriceCents } from "@/lib/products"
import { useAuth } from "@/lib/hooks/use-auth"
import { ProductTagList, ProductTypeBadge } from "@/components/products/product-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MyAssetsPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { data, error, isLoading } = useSWR<UserAssetsResponse>(
    user ? "/me/assets" : null,
    () => api.me.assets<UserAssetsResponse>(),
  )

  if (loading || isLoading) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">资产加载中...</div>
      </div>
    )
  }

  if (!user) return null

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          我的资产加载失败，请稍后重试。
        </div>
      </div>
    )
  }

  const items = data?.data.items ?? []
  const summary = data?.data.summary ?? {
    totalAssetCount: items.length,
    activeAssetCount: items.filter((item) => item.isActive).length,
    paidOrderCount: items.reduce((sum, item) => sum + item.paidOrderCount, 0),
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Assets</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">我的已购资产</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            先基于现有订单和权益做简化聚合，帮助用户看到已经拥有的商品与可用权益。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/products">
            <ArrowLeft className="size-4" />
            返回商品中心
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/me/orders">我的订单</Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">资产总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAssetCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">当前生效</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.activeAssetCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">累计购买次数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.paidOrderCount}</div>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[1.8rem] border-[3px] border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          你还没有已购商品，先去商品中心看看。
        </div>
      ) : (
        <div className="grid gap-5">
          {items.map((item) => (
            <Card key={item.product.id} className="bg-background">
              <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProductTypeBadge type={item.product.type} />
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        item.isActive
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {item.isActive ? "权益生效中" : "权益已过期或未发放"}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">{item.product.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {item.product.summary || item.product.description || "商品资产已归档到当前账号。"}
                    </p>
                  </div>
                  <ProductTagList tags={item.product.tags} />
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Package2 className="size-4" />
                      默认价 {formatPriceCents(item.product.defaultSku.priceCents, item.product.defaultSku.currency)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="size-4" />
                      已购 {item.paidOrderCount} 次
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="size-4" />
                      {item.entitlementExpiresAt
                        ? `到期于 ${new Date(item.entitlementExpiresAt).toLocaleDateString()}`
                        : "长期有效或暂未设置到期"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/products/${item.product.id}`}>查看商品</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
