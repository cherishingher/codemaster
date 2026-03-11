import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import {
  ContentStudioError,
  getContentStudioOverview,
  updateSolutionStudioItem,
  updateVideoStudioItem,
} from "@/server/modules/content-studio/service"

const UpdateSolutionSchema = z.object({
  summary: z.string().trim().max(1000).optional(),
  visibility: z.string().trim().min(1).max(40).optional(),
  accessLevel: z.string().trim().min(1).max(40).optional(),
  isPremium: z.boolean().optional(),
  videoUrl: z.string().trim().url().or(z.literal("")).optional(),
})

const UpdateVideoSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(500).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  thumbnailUrl: z.string().trim().url().or(z.literal("")).optional(),
  assetUri: z.string().trim().url().or(z.literal("")).optional(),
  isPreview: z.boolean().optional(),
})

function mapError(error: unknown) {
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

  if (error instanceof ContentStudioError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }

  console.error("[content-studio]", error)
  return NextResponse.json({ error: "internal_error", message: "内容后台暂时不可用" }, { status: 500 })
}

export async function handleGetContentStudioOverview() {
  try {
    const payload = await getContentStudioOverview()
    return NextResponse.json({ data: payload })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateSolutionStudioItem(req: NextRequest, id: string) {
  try {
    const input = UpdateSolutionSchema.parse(await req.json())
    await updateSolutionStudioItem(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateVideoStudioItem(req: NextRequest, id: string) {
  try {
    const input = UpdateVideoSchema.parse(await req.json())
    await updateVideoStudioItem(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}
