import { NextRequest, NextResponse } from "next/server"
import { ProductListQuerySchema } from "@/server/modules/product-center/schemas"
import { listContentPacks } from "@/server/modules/content-pack-center/service"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = ProductListQuerySchema.omit({ type: true }).parse(searchParamsToObject(searchParams))
  const payload = await listContentPacks(query)
  return NextResponse.json(payload)
}
