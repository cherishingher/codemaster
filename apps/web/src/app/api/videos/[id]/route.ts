import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthUser } from "@/lib/authz"
import { getContentAccessForResource } from "@/server/modules/content-access/service"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(ctx.params)
  const user = await getAuthUser(req)

  const [lesson, access] = await Promise.all([
    db.lesson.findUnique({
      where: { id },
      include: {
        section: {
          include: {
            course: {
              select: {
                id: true,
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    }),
    getContentAccessForResource("video", id, user ?? undefined),
  ])

  if (!lesson || lesson.status !== "published" || !access) {
    return NextResponse.json({ error: "not_found", message: "视频不存在" }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      type: lesson.type,
      summary: lesson.summary,
      thumbnailUrl: lesson.thumbnailUrl,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      course: lesson.section.course,
      locked: !access.allowed,
      access,
      assetUri: access.allowed ? lesson.assetUri : null,
      content: access.allowed ? lesson.content : null,
    },
  })
}
