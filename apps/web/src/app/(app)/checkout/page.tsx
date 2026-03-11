"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import type { CreateOrderResponse, CreatePaymentResponse } from "@/lib/orders"
import type { ProductDetailResponse } from "@/lib/products"
import { formatPriceCents } from "@/lib/products"
import { useAuth } from "@/lib/hooks/use-auth"
import { ProductTypeBadge } from "@/components/products/product-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get("productId")
  const skuId = searchParams.get("skuId")
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { data, error, isLoading } = useSWR<ProductDetailResponse>(
    productId ? `/products/${productId}` : null,
    () => api.products.get<ProductDetailResponse>(productId as string),
  )
  const [selectedSkuId, setSelectedSkuId] = React.useState<string>(skuId ?? "")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!data?.data) return
    const defaultSku = data.data.skus.find((item) => item.id === skuId) ?? data.data.skus.find((item) => item.isDefault) ?? data.data.skus[0]
    setSelectedSkuId(defaultSku?.id ?? "")
  }, [data?.data, skuId])

  const product = data?.data
  const selectedSku = product?.skus.find((item) => item.id === selectedSkuId) ?? product?.skus[0]

  const submitCheckout = async () => {
    if (!user || !product || !selectedSku) return

    setSubmitting(true)
    try {
      const order = await api.orders.create<CreateOrderResponse>({
        productId: product.id,
        skuId: selectedSku.id.startsWith("virtual:") ? undefined : selectedSku.id,
      })

      const payment = await api.payments.create<CreatePaymentResponse>({
        orderId: order.data.id,
        channel: "MOCK",
      })

      router.push(payment.data.payUrl ?? `/payments/${payment.data.paymentNo}`)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "创建订单或支付单失败"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">结算信息加载中...</div>
      </div>
    )
  }

  if (!productId || error || !product) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          结算商品不存在，请返回商品详情页重新选择。
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href={`/products/${product.id}`}>
            <ArrowLeft className="size-4" />
            返回商品详情
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6 md:p-8">
            <div className="space-y-2">
              <ProductTypeBadge type={product.type} />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">确认订单</h1>
              <p className="text-sm text-muted-foreground">
                下单后会创建订单与支付单，mock 支付成功后再更新订单状态并发放权益。
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/40 p-5">
              <div className="text-xl font-semibold text-foreground">{product.name}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {product.summary || product.description || "已配置商品基础信息"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">选择规格</div>
              {product.skus.map((sku) => (
                <button
                  type="button"
                  key={sku.id}
                  onClick={() => setSelectedSkuId(sku.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    sku.id === selectedSku?.id
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-background hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-foreground">{sku.name}</div>
                      {sku.description ? (
                        <div className="mt-1 text-sm text-muted-foreground">{sku.description}</div>
                      ) : null}
                    </div>
                    {sku.isDefault ? (
                      <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
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
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">支付摘要</h2>
              <p className="mt-1 text-sm text-muted-foreground">本期仅支持 `MOCK` 支付渠道。</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/40 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">商品</span>
                <span className="text-foreground">{product.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">规格</span>
                <span className="text-foreground">{selectedSku?.name ?? "未选择"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">支付渠道</span>
                <span className="text-foreground">MOCK</span>
              </div>
              {selectedSku?.validDays ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">权益时长</span>
                  <span className="text-foreground">{selectedSku.validDays} 天</span>
                </div>
              ) : null}
              <div className="border-t border-border/60 pt-3">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-muted-foreground">应付金额</span>
                  <span className="text-3xl font-semibold text-foreground">
                    {selectedSku ? formatPriceCents(selectedSku.priceCents, selectedSku.currency) : "--"}
                  </span>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={submitCheckout} disabled={submitting || !selectedSku}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              提交订单并前往支付
            </Button>

            <div className="text-xs leading-6 text-muted-foreground">
              交易链路：创建订单、创建支付单、进入支付中页面、接收 mock 回调、更新订单状态，并幂等发放权益。
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
