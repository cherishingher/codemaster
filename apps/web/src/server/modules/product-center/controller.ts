import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { AuthUser } from "@/lib/authz"
import {
  AdminProductListQuerySchema,
  ProductListQuerySchema,
  ProductMutationSchema,
} from "@/server/modules/product-center/schemas"
import {
  ProductCenterError,
  createProduct,
  getAdminProductDetail,
  getPublicProductDetail,
  listAdminProducts,
  listPublicProducts,
  listUserAssets,
  updateProduct,
} from "@/server/modules/product-center/service"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

function mapErrorToResponse(error: unknown) {
  if (error instanceof ProductCenterError) {
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
        error: "conflict",
        message: "商品 slug 或 SKU 编码重复",
      },
      { status: 409 },
    )
  }

  console.error("[product-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "服务器开小差了，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleListProducts(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = ProductListQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await listPublicProducts(query)
    return NextResponse.json(payload)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetProduct(id: string) {
  try {
    const product = await getPublicProductDetail(id)
    return NextResponse.json({ data: product })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetMyAssets(user: AuthUser) {
  try {
    const assets = await listUserAssets(user.id)
    return NextResponse.json({ data: assets })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAdminListProducts(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = AdminProductListQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await listAdminProducts(query)
    return NextResponse.json(payload)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAdminGetProduct(id: string) {
  try {
    const product = await getAdminProductDetail(id)
    return NextResponse.json({ data: product })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAdminCreateProduct(req: NextRequest) {
  try {
    const body = ProductMutationSchema.parse(await req.json())
    const product = await createProduct(body)
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAdminUpdateProduct(req: NextRequest, id: string) {
  try {
    const body = ProductMutationSchema.parse(await req.json())
    const product = await updateProduct(id, body)
    return NextResponse.json({ data: product })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}
