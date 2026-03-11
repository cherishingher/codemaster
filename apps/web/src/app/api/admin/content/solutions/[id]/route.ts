import { withAuth } from "@/lib/authz"
import {
  handleGetCmsSolutionDetail,
  handleUpdateCmsSolution,
} from "@/server/modules/content-cms/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_req, { params }) => handleGetCmsSolutionDetail(params.id), {
  roles: "admin",
})

export const PATCH = withAuth(async (req, { params }) => handleUpdateCmsSolution(req, params.id), {
  roles: "admin",
})
