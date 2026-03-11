import { handleGetProduct } from "@/server/modules/product-center/controller"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const resolvedParams = await params
  return handleGetProduct(resolvedParams.id)
}
