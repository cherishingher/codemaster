import Link from "next/link"
import { CreditCard, ReceiptText } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/orders/status-badges"
import { formatPriceCents } from "@/lib/products"
import type { OrderItem } from "@/lib/orders"

export function OrderSummaryCard({
  order,
  showActions = true,
}: {
  order: OrderItem
  showActions?: boolean
}) {
  return (
    <Card className="bg-background">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">订单号 {order.orderNo}</div>
            <div className="text-xl font-semibold text-foreground">
              {order.productName || "自定义订单"}
            </div>
            {order.skuName ? (
              <div className="text-sm text-muted-foreground">规格：{order.skuName}</div>
            ) : null}
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <div>应付金额</div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {formatPriceCents(order.amountCents, order.currency)}
            </div>
          </div>
          <div>
            <div>下单时间</div>
            <div className="mt-1 text-foreground">{new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div>支付时间</div>
            <div className="mt-1 text-foreground">
              {order.paidAt ? new Date(order.paidAt).toLocaleString() : "未支付"}
            </div>
          </div>
        </div>

        {showActions ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/orders/${order.id}`}>
                <ReceiptText className="size-4" />
                查看详情
              </Link>
            </Button>
            {order.status === "PENDING" ? (
              <Button asChild>
                <Link href={order.payments[0] ? `/payments/${order.payments[0].paymentNo}` : `/orders/${order.id}`}>
                  <CreditCard className="size-4" />
                  继续支付
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
