import { withAuth } from "@/lib/authz"
import {
  handleAdminCreateProduct,
  handleAdminListProducts,
} from "@/server/modules/product-center/controller"

export const GET = withAuth(async (req) => {
  return handleAdminListProducts(req)
}, { roles: "admin" })

export const POST = withAuth(async (req) => {
  return handleAdminCreateProduct(req)
}, { roles: "admin" })
