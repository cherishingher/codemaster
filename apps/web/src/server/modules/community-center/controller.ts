import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { AuthUser } from "@/lib/authz"
import { createStudyGroup, getStudyGroupDetail, joinStudyGroup, listStudyGroups } from "@/server/modules/community-center/group.service"
import { getUserPointsSummary, listCommunityRewards, redeemProductWithPoints } from "@/server/modules/community-center/points.service"
import { createCommunityComment, createCommunityPost, getCommunityPostDetail, listCommunityFeed } from "@/server/modules/community-center/post.service"
import {
  CommunityFeedQuerySchema,
  CommunityGroupsQuerySchema,
  CreateCommunityCommentSchema,
  CreateCommunityPostSchema,
  CreateStudyGroupSchema,
} from "@/server/modules/community-center/schemas"
import { CommunityError } from "@/server/modules/community-center/shared"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

function mapErrorToResponse(error: unknown) {
  if (error instanceof CommunityError) {
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

  console.error("[community-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "社区服务暂时不可用，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleListStudyGroups(req: NextRequest, user?: AuthUser | null) {
  try {
    const { searchParams } = new URL(req.url)
    const query = CommunityGroupsQuerySchema.parse(searchParamsToObject(searchParams))
    const groups = await listStudyGroups(user ?? undefined, query)
    return NextResponse.json({ data: groups })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateStudyGroup(req: NextRequest, user: AuthUser) {
  try {
    const body = CreateStudyGroupSchema.parse(await req.json())
    const group = await createStudyGroup(user.id, body)
    return NextResponse.json({ data: { id: group.id, status: group.status } }, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetStudyGroup(id: string, user?: AuthUser | null) {
  try {
    const group = await getStudyGroupDetail(id, user ?? undefined)
    if (!group) {
      return NextResponse.json({ error: "not_found", message: "学习小组不存在" }, { status: 404 })
    }
    return NextResponse.json({ data: group })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleJoinStudyGroup(id: string, user: AuthUser) {
  try {
    const member = await joinStudyGroup(user.id, id)
    return NextResponse.json({ data: { id: member.id, status: member.status } })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListCommunityFeed(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = CommunityFeedQuerySchema.parse(searchParamsToObject(searchParams))
    const posts = await listCommunityFeed(query)
    return NextResponse.json({ data: posts })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateCommunityPost(req: NextRequest, user: AuthUser) {
  try {
    const body = CreateCommunityPostSchema.parse(await req.json())
    const post = await createCommunityPost(user.id, body)
    return NextResponse.json({ data: { id: post.id, status: post.status } }, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetCommunityPost(id: string, user?: AuthUser | null) {
  try {
    const post = await getCommunityPostDetail(id, user ?? undefined)
    if (!post) {
      return NextResponse.json({ error: "not_found", message: "讨论内容不存在" }, { status: 404 })
    }
    return NextResponse.json({ data: post })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateCommunityComment(req: NextRequest, postId: string, user: AuthUser) {
  try {
    const body = CreateCommunityCommentSchema.parse(await req.json())
    const comment = await createCommunityComment(user.id, postId, body.content)
    return NextResponse.json({ data: comment }, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetMyPoints(user: AuthUser) {
  try {
    const summary = await getUserPointsSummary(user.id)
    return NextResponse.json({ data: summary })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListRewards(user?: AuthUser | null) {
  try {
    const rewards = await listCommunityRewards(user?.id)
    return NextResponse.json({ data: rewards })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleRedeemReward(productId: string, user: AuthUser) {
  try {
    const result = await redeemProductWithPoints(user.id, productId)
    return NextResponse.json({ data: result })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}
