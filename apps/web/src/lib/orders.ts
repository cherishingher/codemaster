export type OrderStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "COMPLETED"
  | "CLOSED"
  | "REFUNDING"
  | "REFUNDED"
  | string

export type PaymentChannel = "MOCK" | string

export type PaymentStatus = "CREATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CLOSED" | string

export type RefundStatus = "CREATED" | "APPROVED" | "REJECTED" | "REFUNDED" | string

export type RefundRequestItem = {
  id: string
  refundNo: string
  status: RefundStatus
  reason?: string | null
  note?: string | null
  createdAt: string
  processedAt?: string | null
}

export type OrderPaymentItem = {
  id: string
  paymentNo: string
  channel: PaymentChannel
  status: PaymentStatus
  amountCents?: number | null
  tradeNo?: string | null
  failureReason?: string | null
  createdAt: string
  paidAt?: string | null
  callbackAt?: string | null
}

export type OrderItem = {
  id: string
  orderNo: string
  productId?: string | null
  skuId?: string | null
  productName?: string | null
  skuName?: string | null
  productType?: string | null
  amountCents: number
  currency: string
  validDays?: number | null
  status: OrderStatus
  createdAt: string
  paidAt?: string | null
  closedAt?: string | null
  closedReason?: string | null
  refundRequestedAt?: string | null
  refundProcessedAt?: string | null
  payments: OrderPaymentItem[]
  refundRequest?: RefundRequestItem | null
}

export type PaymentItem = {
  id: string
  paymentNo: string
  orderId: string
  orderNo: string
  channel: PaymentChannel
  status: PaymentStatus
  amountCents?: number | null
  tradeNo?: string | null
  failureReason?: string | null
  createdAt: string
  paidAt?: string | null
  callbackAt?: string | null
  order: OrderItem
}

export type OrderListResponse = {
  data: OrderItem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type OrderDetailResponse = {
  data: OrderItem
}

export type PaymentDetailResponse = {
  data: PaymentItem
}

export type CreateOrderInput = {
  productId?: string
  skuId?: string
  productType?: string
  amountCents?: number
}

export type CreateOrderResponse = {
  data: OrderItem
}

export type CreatePaymentInput = {
  orderId: string
  channel?: PaymentChannel
}

export type CreatePaymentResponse = {
  data: PaymentItem & {
    payUrl?: string | null
  }
}

export type PaymentCallbackInput = {
  paymentNo: string
  status: "SUCCEEDED" | "FAILED"
  tradeNo?: string
  failureReason?: string
  payload?: Record<string, unknown> | null
}

export type PaymentCallbackResponse = {
  data: PaymentItem
}

export type PayOrderResponse = {
  data: OrderItem & {
    channel?: string | null
  }
}

export type RefundRequestInput = {
  reason?: string
  note?: string
}

export type RefundRequestResponse = {
  data: RefundRequestItem
}

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "CREATED":
      return "已创建"
    case "PENDING":
      return "待支付"
    case "PAID":
      return "已支付"
    case "COMPLETED":
      return "已完成"
    case "CLOSED":
      return "已关闭"
    case "REFUNDING":
      return "退款中"
    case "REFUNDED":
      return "已退款"
    default:
      return status
  }
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "CREATED":
      return "已创建"
    case "PENDING":
      return "支付处理中"
    case "SUCCEEDED":
      return "支付成功"
    case "FAILED":
      return "支付失败"
    case "CLOSED":
      return "已关闭"
    default:
      return status
  }
}
