import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { createLogger } from "@/lib/logger"
import { OrderCenterError } from "@/server/modules/order-center/shared"

const logger = createLogger("order-center")

export function mapOrderCenterError(error: unknown) {
  if (error instanceof OrderCenterError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: "请求参数不合法",
        issues: error.flatten(),
      },
      { status: 400 },
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      {
        error: "duplicate_record",
        message: "订单号、支付单号或退款单号重复，请重试",
      },
      { status: 409 },
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return NextResponse.json(
      {
        error: "constraint_failed",
        message: "订单、支付或商品关联关系不合法",
      },
      { status: 409 },
    )
  }

  logger.error("unhandled_error", { error })
  return NextResponse.json(
    {
      error: "internal_error",
      message: "服务器开小差了，请稍后再试",
    },
    { status: 500 },
  )
}
