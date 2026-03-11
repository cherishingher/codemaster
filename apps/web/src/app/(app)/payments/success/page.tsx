"use client"

import Link from "next/link"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Package2, ReceiptText } from "lucide-react"
import { api } from "@/lib/api-client"
import type { OrderDetailResponse } from "@/lib/orders"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { OrderSummaryCard } from "@/components/orders/order-summary-card"

export default function PaymentSuccessPage() {
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
            <div className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">支付成功</h1>
            <p className="text-sm text-muted-foreground">
              订单状态已经完成结算，权益发放会按支付单幂等执行，会员权限和内容解锁刷新后会立即生效。
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/me/orders">
                  <ReceiptText className="size-4" />
                  查看我的订单
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/me/assets">
                  <Package2 className="size-4" />
                  查看我的资产
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {data?.data ? <OrderSummaryCard order={data.data} showActions={false} /> : null}
      </div>
    </div>
  )
}
