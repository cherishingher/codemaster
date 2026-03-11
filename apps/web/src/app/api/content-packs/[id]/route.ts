import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { getContentPackDetail } from "@/server/modules/content-pack-center/service"
import { ProductCenterError } from "@/server/modules/product-center/service"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const user = await getAuthUser(req)

  try {
    const detail = await getContentPackDetail(id, user ?? undefined)
    return NextResponse.json({ data: detail })
  } catch (error) {
    if (
      (error instanceof Error && error.message === "content_pack_not_found") ||
      (error instanceof ProductCenterError && error.status === 404)
    ) {
      return NextResponse.json(
        {
          error: "not_found",
          message: "内容包不存在",
        },
        { status: 404 },
      )
    }

    console.error("[content-pack-detail]", error)
    return NextResponse.json(
      {
        error: "internal_error",
        message: "加载内容包详情失败",
      },
      { status: 500 },
    )
  }
}
