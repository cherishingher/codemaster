"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import type {
  CreatePaymentResponse,
  OrderDetailResponse,
  RefundRequestResponse,
} from "@/lib/orders"
import { PaymentStatusBadge } from "@/components/orders/status-badges"
import { OrderSummaryCard } from "@/components/orders/order-summary-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/hooks/use-auth"

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { data, error, isLoading, mutate } = useSWR<OrderDetailResponse>(
    user && id ? `/orders/${id}` : null,
    () => api.orders.get<OrderDetailResponse>(id as string),
  )
  const [reason, setReason] = React.useState("")
  const [note, setNote] = React.useState("")
  const [submittingPay, setSubmittingPay] = React.useState(false)
  const [submittingRefund, setSubmittingRefund] = React.useState(false)

  const order = data?.data

  const createPayment = async () => {
    if (!order) return
    setSubmittingPay(true)
    try {
      const payment = await api.payments.create<CreatePaymentResponse>({
        orderId: order.id,
        channel: "MOCK",
      })
      router.push(payment.data.payUrl ?? `/payments/${payment.data.paymentNo}`)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "创建支付单失败"
      toast.error(message)
    } finally {
      setSubmittingPay(false)
    }
  }

  const submitRefundRequest = async () => {
    if (!order) return
    setSubmittingRefund(true)
    try {
      await api.orders.requestRefund<RefundRequestResponse>(order.id, {
        reason: reason.trim() || undefined,
        note: note.trim() || undefined,
      })
      await mutate()
      toast.success("退款申请已提交")
      setReason("")
      setNote("")
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "退款申请提交失败"
      toast.error(message)
    } finally {
      setSubmittingRefund(false)
    }
  }

  if (loading || isLoading) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">订单详情加载中...</div>
  }

  if (error || !order) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          订单不存在或无权访问。
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href="/me/orders">
            <ArrowLeft className="size-4" />
            返回我的订单
          </Link>
        </Button>
      </div>

      <div className="space-y-6">
        <OrderSummaryCard order={order} showActions={false} />

        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">支付记录</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                订单状态与支付状态分离存储，页面刷新后可从数据库重新读取。
              </p>
            </div>

            {order.payments.length === 0 ? (
              <div className="text-sm text-muted-foreground">当前订单还没有支付单。</div>
            ) : (
              <div className="space-y-3">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">支付单号 {payment.paymentNo}</div>
                        <div className="mt-1 text-base font-semibold text-foreground">{payment.channel}</div>
                      </div>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                      <div>创建时间：{new Date(payment.createdAt).toLocaleString()}</div>
                      <div>支付时间：{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "未支付"}</div>
                      <div>交易号：{payment.tradeNo ?? "暂无"}</div>
                    </div>
                    {payment.failureReason ? (
                      <div className="mt-2 text-sm text-red-700">失败原因：{payment.failureReason}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {(order.status === "CREATED" || order.status === "PENDING") ? (
              <Button onClick={createPayment} disabled={submittingPay}>
                {submittingPay ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {order.payments.length > 0 ? "继续支付" : "创建支付单"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">退款申请</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                一期先提供申请入口，提交后订单会进入 `REFUNDING`。`REFUNDED` 状态为后续处理预留。
              </p>
            </div>

            {order.refundRequest ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800">
                已提交退款申请：{order.refundRequest.refundNo}，当前状态 {order.refundRequest.status}
              </div>
            ) : order.status === "PAID" || order.status === "COMPLETED" ? (
              <>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="退款原因（可选）"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="补充说明（可选）"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button variant="secondary" onClick={submitRefundRequest} disabled={submittingRefund}>
                  {submittingRefund ? <Loader2 className="size-4 animate-spin" /> : null}
                  提交退款申请
                </Button>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">当前订单状态不支持提交退款申请。</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
