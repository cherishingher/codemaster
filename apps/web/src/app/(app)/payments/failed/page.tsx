"use client"

import Link from "next/link"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { RotateCcw, XCircle } from "lucide-react"
import { api } from "@/lib/api-client"
import type { OrderDetailResponse } from "@/lib/orders"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { OrderSummaryCard } from "@/components/orders/order-summary-card"

export default function PaymentFailedPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId")
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { data } = useSWR<OrderDetailResponse>(
    user && orderId ? `/orders/${orderId}` : null,
    () => api.orders.get<OrderDetailResponse>(orderId as string),
  )

  if (loading) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">结果加载中...</div>
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6 text-center md:p-8">
            <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-red-500/10 text-red-600">
              <XCircle className="size-8" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">支付失败</h1>
            <p className="text-sm text-muted-foreground">
              mock 回调已将订单关闭。你可以回到商品详情重新发起一笔新订单，或查看当前订单详情。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/products">
                  <RotateCcw className="size-4" />
                  返回商品中心
                </Link>
              </Button>
              {orderId ? (
                <Button asChild variant="secondary">
                  <Link href={`/orders/${orderId}`}>查看订单详情</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {data?.data ? <OrderSummaryCard order={data.data} showActions={false} /> : null}
      </div>
    </div>
  )
}
