"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Lock, Package2, PlayCircle, Wallet } from "lucide-react"
import { api } from "@/lib/api-client"
import type { ContentPackDetailResponse } from "@/lib/content-packs"
import { formatContentAccessRequirement } from "@/lib/content-access"
import type { ProductDetailResponse, UserAssetsResponse } from "@/lib/products"
import { formatPriceCents } from "@/lib/products"
import { useAuth } from "@/lib/hooks/use-auth"
import { ProductTagList, ProductTypeBadge } from "@/components/products/product-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function getIncludedTypeLabel(type: string) {
  switch (type) {
    case "training_path":
      return "训练路径"
    case "solution":
      return "高级题解"
    case "video":
      return "视频解析"
    case "problem":
      return "练习题"
    case "problem_set":
      return "专项题单"
    default:
      return type
  }
}

export default function ProductDetailPage() {
  const params = useParams()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const { user } = useAuth()
  const { data, error, isLoading } = useSWR<ProductDetailResponse>(
    id ? `/products/${id}` : null,
    () => api.products.get<ProductDetailResponse>(id as string),
  )
  const { data: assetsResponse } = useSWR<UserAssetsResponse>(
    user ? "/me/assets" : null,
    () => api.me.assets<UserAssetsResponse>(),
  )
  const product = data?.data
  const { data: contentPackData, isLoading: isContentPackLoading } = useSWR<ContentPackDetailResponse>(
    product?.type === "content_pack" ? `/content-packs/${product.id}` : null,
    () => api.contentPacks.get<ContentPackDetailResponse>(product!.id),
  )

  const [selectedSkuId, setSelectedSkuId] = React.useState<string>("")

  React.useEffect(() => {
    if (!product) return
    const defaultSku = product.skus.find((item) => item.isDefault) ?? product.skus[0]
    setSelectedSkuId((current) => current || defaultSku?.id || "")
  }, [product])

  const ownedAsset = assetsResponse?.data.items.find((item) => item.product.id === product?.id)

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          商品不存在或暂未开放。
        </div>
      </div>
    )
  }

  if (isLoading || !product) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">商品详情加载中...</div>
      </div>
    )
  }

  const selectedSku = product.skus.find((item) => item.id === selectedSkuId) ?? product.skus[0]
  const checkoutHref =
    selectedSku
      ? `/checkout?productId=${encodeURIComponent(product.id)}&skuId=${encodeURIComponent(selectedSku.id)}`
      : `/checkout?productId=${encodeURIComponent(product.id)}`

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href="/products">
            <ArrowLeft className="size-4" />
            返回商品中心
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <ProductTypeBadge type={product.type} />
                <span className="text-xs text-muted-foreground">商品状态：{product.status}</span>
                {ownedAsset ? (
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      ownedAsset.isActive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {ownedAsset.isActive ? "已购且权益生效中" : "已购，可续费或再次购买"}
                  </span>
                ) : null}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{product.name}</h1>
                <p className="text-base leading-8 text-muted-foreground">
                  {product.description || product.summary || "该商品已配置基础信息，可被订单模块直接复用。"}
                </p>
              </div>
              <ProductTagList tags={product.tags} />
            </div>

            {product.coverImage ? (
              <div
                className="min-h-[260px] rounded-[1.5rem] border border-border/60 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${product.coverImage})` }}
              />
            ) : null}

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">商品权益</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {product.benefits.map((benefit) => (
                  <div key={benefit.id} className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">{benefit.title}</div>
                        {benefit.description ? (
                          <div className="text-sm text-muted-foreground">{benefit.description}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {product.type === "content_pack" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">包含内容</h2>
                    <p className="text-sm text-muted-foreground">
                      内容包会复用统一权限中心，购买后对应题解、视频和训练路径会自动解锁。
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/content-packs">查看全部内容包</Link>
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {isContentPackLoading ? (
                    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      正在加载内容包清单...
                    </div>
                  ) : contentPackData?.data.includedTargets?.length ? (
                    contentPackData.data.includedTargets.map((item) => (
                      <div key={`${item.type}:${item.id}`} className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{item.title}</div>
                          <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                            {getIncludedTypeLabel(item.type)}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px]",
                              item.locked
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-700"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                            )}
                          >
                            {item.locked
                              ? item.access
                                ? formatContentAccessRequirement(item.access.policy.requiredSources)
                                : "待解锁"
                              : "已可访问"}
                          </span>
                        </div>
                        {item.summary ? (
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.summary}</p>
                        ) : null}
                        {item.meta ? <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p> : null}
                        {item.href ? (
                          <div className="mt-3">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={item.href}>
                                去查看内容
                                <PlayCircle className="size-4" />
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      当前内容包还没有配置 includedTargets，前往后台商品管理补充即可。
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">规格与价格</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  当前先完成 SKU 展示，支付模块会直接复用这些规格数据。
                </p>
              </div>
              <div className="space-y-3">
                {product.skus.map((sku) => (
                  <div
                    key={sku.id}
                    className={cn(
                      "cursor-pointer rounded-2xl border bg-card p-4 transition-colors",
                      sku.id === selectedSku?.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40",
                    )}
                    onClick={() => setSelectedSkuId(sku.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-foreground">{sku.name}</div>
                        {sku.description ? (
                          <div className="text-sm text-muted-foreground">{sku.description}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">SKU 编码：{sku.skuCode}</div>
                      </div>
                      {sku.isDefault ? (
                        <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          默认规格
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-2xl font-semibold text-foreground">
                        {formatPriceCents(sku.priceCents, sku.currency)}
                      </span>
                      {sku.originalPriceCents != null ? (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatPriceCents(sku.originalPriceCents, sku.currency)}
                        </span>
                      ) : null}
                    </div>
                    {sku.validDays ? (
                      <div className="mt-1 text-xs text-muted-foreground">有效期 {sku.validDays} 天</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              {ownedAsset ? (
                <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                  <div className="text-sm font-semibold text-foreground">当前账号已拥有该商品</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    已购 {ownedAsset.paidOrderCount} 次
                    {ownedAsset.entitlementExpiresAt
                      ? ` · 权益到期 ${new Date(ownedAsset.entitlementExpiresAt).toLocaleDateString()}`
                      : " · 当前为长期有效或未设置到期时间"}
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-3">
                <Lock className="mt-1 size-5 text-primary" />
                <div>
                  <div className="text-base font-semibold text-foreground">mock 支付链路</div>
                  <div className="text-sm text-muted-foreground">
                    当前会进入标准结算页与支付中页面，再由 mock 回调完成支付和权益发放，后续正式支付可以直接复用。
                  </div>
                </div>
              </div>
              {selectedSku ? (
                <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                  <div className="text-sm text-muted-foreground">当前选择</div>
                  <div className="mt-1 text-base font-semibold text-foreground">{selectedSku.name}</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-2xl font-semibold text-foreground">
                      {formatPriceCents(selectedSku.priceCents, selectedSku.currency)}
                    </span>
                    {selectedSku.originalPriceCents != null ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPriceCents(selectedSku.originalPriceCents, selectedSku.currency)}
                      </span>
                    ) : null}
                  </div>
                  {selectedSku.validDays ? (
                    <div className="mt-1 text-xs text-muted-foreground">权益时长 {selectedSku.validDays} 天</div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild disabled={product.status !== "active"}>
                  <Link href={user ? checkoutHref : "/login"}>
                    <Wallet className="size-4" />
                    {user ? (ownedAsset ? "再次购买 / 续费" : "去结算") : "登录后结算"}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={user ? "/me/assets" : "/login"}>
                    <Package2 className="size-4" />
                    {user ? "查看我的资产" : "登录后查看资产"}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={user ? "/me/orders" : "/login"}>我的订单</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/products">继续看其他商品</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
