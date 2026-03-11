import { NextRequest, NextResponse } from "next/server"
import type { AuthUser } from "@/lib/authz"
import {
  CreateOrderSchema,
  OrderListQuerySchema,
  RefundRequestSchema,
} from "@/server/modules/order-center/schemas"
import {
  createRefundRequestForOrder,
  createUserOrder,
  getUserOrderDetail,
  listUserOrders,
} from "@/server/modules/order-center/order.service"
import { mapOrderCenterError } from "@/server/modules/order-center/controller-shared"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

export async function handleListOrders(req: NextRequest, user: AuthUser) {
  try {
    const { searchParams } = new URL(req.url)
    const query = OrderListQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await listUserOrders(user.id, query)
    return NextResponse.json(payload)
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handleGetOrder(orderId: string, user: AuthUser) {
  try {
    const payload = await getUserOrderDetail(user.id, orderId)
    return NextResponse.json(payload)
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handleCreateOrder(req: NextRequest, user: AuthUser) {
  try {
    const payload = CreateOrderSchema.parse(await req.json())
    const created = await createUserOrder(user.id, payload)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return mapOrderCenterError(error)
  }
}

export async function handleRefundRequest(req: NextRequest, orderId: string, user: AuthUser) {
  try {
    let rawPayload: unknown = {}
    try {
      rawPayload = await req.json()
    } catch {
      rawPayload = {}
    }

    const payload = RefundRequestSchema.parse(rawPayload)
    const created = await createRefundRequestForOrder(user.id, orderId, payload)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return mapOrderCenterError(error)
  }
}
