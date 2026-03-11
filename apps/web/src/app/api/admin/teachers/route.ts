import { withAuth } from "@/lib/authz"
import {
  handleListTeacherProfiles,
  handleUpsertTeacherProfile,
} from "@/server/modules/edu-admin/controller"

export const dynamic = "force-dynamic"

export const GET = withAuth(async () => handleListTeacherProfiles(), { roles: "admin" })
export const POST = withAuth(async (req) => handleUpsertTeacherProfile(req), { roles: "admin" })
