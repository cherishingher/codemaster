import { withAuth } from "@/lib/authz"
import {
  handleAdminGetProduct,
  handleAdminUpdateProduct,
} from "@/server/modules/product-center/controller"

export const GET = withAuth(async (_req, { params }) => {
  return handleAdminGetProduct(params.id)
}, { roles: "admin" })

export const PATCH = withAuth(async (req, { params }) => {
  return handleAdminUpdateProduct(req, params.id)
}, { roles: "admin" })
