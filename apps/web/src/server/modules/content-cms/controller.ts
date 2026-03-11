import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import type { AuthUser } from "@/lib/authz"
import {
  ContentCmsError,
  createCmsPath,
  createContentAsset,
  getCmsPathDetail,
  getCmsSolutionDetail,
  getContentCmsOverview,
  listCmsPaths,
  listContentAssets,
  listVideoLessons,
  listWorkflowLogs,
  replaceCmsPathItems,
  transitionContentStatus,
  updateCmsPath,
  updateCmsSolution,
  updateVideoLesson,
} from "@/server/modules/content-cms/service"

const UpdateSolutionSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().max(1000).optional(),
  content: z.string().min(1).optional(),
  templateType: z.string().trim().max(60).optional(),
  visibility: z.string().trim().min(1).max(40).optional(),
  accessLevel: z.string().trim().min(1).max(40).optional(),
  isPremium: z.boolean().optional(),
  videoUrl: z.string().trim().url().or(z.literal("")).optional(),
})

const CreateAssetSchema = z.object({
  assetType: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  sourceUrl: z.string().trim().url(),
  mimeType: z.string().trim().max(80).optional(),
  durationSec: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().trim().url().optional(),
  resourceType: z.string().trim().max(40).optional(),
  resourceId: z.string().trim().max(64).optional(),
})

const UpdateVideoSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().max(500).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  assetUri: z.string().trim().url().or(z.literal("")).optional(),
  isPreview: z.boolean().optional(),
  status: z.enum(["draft", "review", "published"]).optional(),
})

const UpdatePathSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  visibility: z.string().trim().min(1).max(40).optional(),
  status: z.enum(["draft", "review", "published"]).optional(),
  kind: z.string().trim().max(40).optional(),
})

const CreatePathSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  visibility: z.string().trim().min(1).max(40).optional(),
})

const ReplacePathItemsSchema = z.object({
  items: z.array(z.object({
    problemId: z.string().trim().min(1).max(64),
    orderIndex: z.number().int().min(0),
  })),
})

const TransitionSchema = z.object({
  resourceType: z.enum(["solution", "video", "training_path"]),
  resourceId: z.string().trim().min(1).max(64),
  toStatus: z.enum(["draft", "review", "published"]),
  note: z.string().trim().max(500).optional(),
})

function mapError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid_payload", message: "请求参数不合法", issues: error.flatten() },
      { status: 400 },
    )
  }

  if (error instanceof ContentCmsError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }

  console.error("[content-cms]", error)
  return NextResponse.json({ error: "internal_error", message: "内容后台暂时不可用" }, { status: 500 })
}

export async function handleGetCmsOverview() {
  try {
    const data = await getContentCmsOverview()
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetCmsSolutionDetail(id: string) {
  try {
    const data = await getCmsSolutionDetail(id)
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateCmsSolution(req: NextRequest, id: string) {
  try {
    const input = UpdateSolutionSchema.parse(await req.json())
    await updateCmsSolution(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListCmsVideos() {
  try {
    const data = await listVideoLessons()
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateCmsAsset(req: NextRequest, user: AuthUser) {
  try {
    const input = CreateAssetSchema.parse(await req.json())
    const data = await createContentAsset(input, user)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListCmsAssets(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const data = await listContentAssets(
      searchParams.get("resourceType") ?? undefined,
      searchParams.get("resourceId") ?? undefined,
    )
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateCmsVideo(req: NextRequest, id: string) {
  try {
    const input = UpdateVideoSchema.parse(await req.json())
    await updateVideoLesson(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListCmsPaths() {
  try {
    const data = await listCmsPaths()
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateCmsPath(req: NextRequest, user: AuthUser) {
  try {
    const input = CreatePathSchema.parse(await req.json())
    const data = await createCmsPath(input, user)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetCmsPathDetail(id: string) {
  try {
    const data = await getCmsPathDetail(id)
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateCmsPath(req: NextRequest, id: string) {
  try {
    const input = UpdatePathSchema.parse(await req.json())
    await updateCmsPath(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleReplaceCmsPathItems(req: NextRequest, id: string) {
  try {
    const input = ReplacePathItemsSchema.parse(await req.json())
    await replaceCmsPathItems(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleTransitionCmsStatus(req: NextRequest, user: AuthUser) {
  try {
    const input = TransitionSchema.parse(await req.json())
    const data = await transitionContentStatus(input, user)
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListWorkflowLogs(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const resourceType = searchParams.get("resourceType") as "solution" | "video" | "training_path" | null
    const resourceId = searchParams.get("resourceId") ?? undefined
    const data = await listWorkflowLogs({
      resourceType: resourceType ?? undefined,
      resourceId,
      limit: 100,
    })
    return NextResponse.json({ data })
  } catch (error) {
    return mapError(error)
  }
}
