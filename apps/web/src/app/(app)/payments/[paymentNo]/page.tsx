"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import type { PaymentCallbackResponse, PaymentDetailResponse } from "@/lib/orders"
import { PaymentStatusBadge } from "@/components/orders/status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatPriceCents } from "@/lib/products"
import { useAuth } from "@/lib/hooks/use-auth"

export default function PaymentPendingPage() {
  const router = useRouter()
  const params = useParams()
  const rawPaymentNo = params.paymentNo
  const paymentNo = Array.isArray(rawPaymentNo) ? rawPaymentNo[0] : rawPaymentNo
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { data, error, isLoading, mutate } = useSWR<PaymentDetailResponse>(
    user && paymentNo ? `/payments/${paymentNo}` : null,
    () => api.payments.get<PaymentDetailResponse>(paymentNo as string),
    { refreshInterval: 3000 },
  )
  const [submitting, setSubmitting] = React.useState<"success" | "failed" | null>(null)

  React.useEffect(() => {
    const status = data?.data.status
    if (!status) return
    if (status === "SUCCEEDED") {
      router.replace(`/payments/success?orderId=${encodeURIComponent(data.data.order.id)}&paymentNo=${encodeURIComponent(data.data.paymentNo)}`)
    }
    if (status === "FAILED") {
      router.replace(`/payments/failed?orderId=${encodeURIComponent(data.data.order.id)}&paymentNo=${encodeURIComponent(data.data.paymentNo)}`)
    }
  }, [data?.data.order.id, data?.data.paymentNo, data?.data.status, router])

  const triggerCallback = async (status: "SUCCEEDED" | "FAILED") => {
    if (!paymentNo) return
    setSubmitting(status === "SUCCEEDED" ? "success" : "failed")
    try {
      const result = await api.payments.callback<PaymentCallbackResponse>({
        paymentNo,
        status,
        failureReason: status === "FAILED" ? "MOCK 手动失败" : undefined,
        payload: {
          from: "payment-pending-page",
        },
      })

      await mutate(result, false)
      if (result.data.status === "SUCCEEDED") {
        router.replace(`/payments/success?orderId=${encodeURIComponent(result.data.order.id)}&paymentNo=${encodeURIComponent(result.data.paymentNo)}`)
      } else {
        router.replace(`/payments/failed?orderId=${encodeURIComponent(result.data.order.id)}&paymentNo=${encodeURIComponent(result.data.paymentNo)}`)
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "支付回调失败"
      toast.error(message)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">支付单加载中...</div>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          支付单不存在或无权访问。
        </div>
      </div>
    )
  }

  const payment = data.data

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href={`/orders/${payment.order.id}`}>
            <ArrowLeft className="size-4" />
            返回订单详情
          </Link>
        </Button>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6 md:p-8">
            <div className="space-y-2 text-center">
              <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="size-7 animate-spin" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">支付中</h1>
              <p className="text-sm text-muted-foreground">
                当前为 mock 支付页。你可以手动触发成功或失败回调，用于验证订单状态流转与权益发放。
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">支付单号</div>
                  <div className="text-base font-semibold text-foreground">{payment.paymentNo}</div>
                </div>
                <PaymentStatusBadge status={payment.status} />
              </div>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <div>
                  <div>订单号</div>
                  <div className="mt-1 text-foreground">{payment.order.orderNo}</div>
                </div>
                <div>
                  <div>支付金额</div>
                  <div className="mt-1 text-foreground">
                    {formatPriceCents(payment.amountCents ?? payment.order.amountCents, payment.order.currency)}
                  </div>
                </div>
                <div>
                  <div>商品</div>
                  <div className="mt-1 text-foreground">{payment.order.productName ?? "自定义订单"}</div>
                </div>
                <div>
                  <div>渠道</div>
                  <div className="mt-1 text-foreground">{payment.channel}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={() => triggerCallback("SUCCEEDED")} disabled={submitting !== null}>
                {submitting === "success" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                模拟支付成功
              </Button>
              <Button variant="secondary" onClick={() => triggerCallback("FAILED")} disabled={submitting !== null}>
                {submitting === "failed" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                模拟支付失败
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
