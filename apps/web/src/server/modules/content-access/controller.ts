import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import type { ContentResourceType } from "@/lib/content-access"
import { getContentAccessForResource, getResourceAccessPolicy } from "@/server/modules/content-access/service"

const SUPPORTED_RESOURCE_TYPES = new Set<ContentResourceType>([
  "solution",
  "video",
  "training_path",
  "learning_report",
  "camp",
  "contest",
  "contest_analysis",
  "contest_report",
])

export async function handleGetAccessCheck(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const resourceType = searchParams.get("resourceType") as ContentResourceType | null
  const resourceId = searchParams.get("resourceId")

  if (!resourceType || !SUPPORTED_RESOURCE_TYPES.has(resourceType) || !resourceId) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "resourceType 或 resourceId 不合法",
      },
      { status: 400 },
    )
  }

  const user = await getAuthUser(req)
  const [policy, access] = await Promise.all([
    getResourceAccessPolicy(resourceType, resourceId),
    getContentAccessForResource(resourceType, resourceId, user ?? undefined),
  ])

  if (!policy || !access) {
    return NextResponse.json(
      {
        error: "not_found",
        message: "资源不存在",
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    data: access,
  })
}
