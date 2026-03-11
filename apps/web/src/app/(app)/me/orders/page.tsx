"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api-client"
import type { OrderListResponse } from "@/lib/orders"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { OrderSummaryCard } from "@/components/orders/order-summary-card"

export default function MyOrdersPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const [page, setPage] = React.useState(1)
  const { data, error, isLoading } = useSWR<OrderListResponse>(
    user ? `/me/orders?page=${page}` : null,
    () => api.me.orders<OrderListResponse>({ page: String(page), limit: "10" }),
  )

  if (loading || isLoading) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">订单加载中...</div>
  }

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          我的订单加载失败，请稍后重试。
        </div>
      </div>
    )
  }

  const orders = data?.data ?? []

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Orders</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">我的订单</h1>
          <p className="mt-2 text-sm text-muted-foreground">查看当前账号的订单、支付与退款申请状态。</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/me/assets">我的资产</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/products">
              <ArrowLeft className="size-4" />
              返回商品中心
            </Link>
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-[1.8rem] border-[3px] border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          当前还没有订单记录。
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderSummaryCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {data ? (
        <div className="mt-8 flex items-center justify-end gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            上一页
          </Button>
          <Button
            variant="secondary"
            disabled={data.meta.totalPages === 0 || page >= data.meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            下一页
          </Button>
        </div>
      ) : null}
    </div>
  )
}
