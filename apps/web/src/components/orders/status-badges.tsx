import { Badge } from "@/components/ui/badge"
import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders"

function getOrderClass(status: OrderStatus) {
  switch (status) {
    case "CREATED":
      return "border-slate-500/30 bg-slate-500/10 text-slate-700"
    case "PENDING":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700"
    case "PAID":
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    case "CLOSED":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700"
    case "REFUNDING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700"
    case "REFUNDED":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700"
    default:
      return "border-border bg-secondary text-foreground"
  }
}

function getPaymentClass(status: PaymentStatus) {
  switch (status) {
    case "CREATED":
    case "PENDING":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700"
    case "SUCCEEDED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    case "FAILED":
      return "border-red-500/30 bg-red-500/10 text-red-700"
    case "CLOSED":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700"
    default:
      return "border-border bg-secondary text-foreground"
  }
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={getOrderClass(status)}>
      {getOrderStatusLabel(status)}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={getPaymentClass(status)}>
      {getPaymentStatusLabel(status)}
    </Badge>
  )
}
