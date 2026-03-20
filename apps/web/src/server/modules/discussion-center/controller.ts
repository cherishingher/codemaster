import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { AuthUser } from "@/lib/authz"
import { jsonData, jsonList } from "@/lib/api-response"
import {
  createDiscussionComment,
  deleteDiscussionComment,
  listDiscussionComments,
  updateDiscussionComment,
} from "@/server/modules/discussion-center/comment.service"
import {
  createDiscussionReport,
  favoriteDiscussionPost,
  likeDiscussionComment,
  likeDiscussionPost,
  unfavoriteDiscussionPost,
  unlikeDiscussionComment,
  unlikeDiscussionPost,
} from "@/server/modules/discussion-center/interaction.service"
import {
  auditDiscussionComment,
  auditDiscussionPost,
  listDiscussionCommentsForModeration,
  listDiscussionPostsForModeration,
  listDiscussionReportsForModeration,
  markDiscussionPostSolved,
  moderateDiscussionComment,
  moderateDiscussionPost,
  resolveDiscussionReport,
  setDiscussionBestComment,
} from "@/server/modules/discussion-center/moderation.service"
import {
  createDiscussionPost,
  deleteDiscussionPost,
  getDiscussionPostDetail,
  listDiscussionPosts,
  updateDiscussionPost,
} from "@/server/modules/discussion-center/post.service"
import {
  AuditDiscussionTargetSchema,
  CreateDiscussionCommentSchema,
  CreateDiscussionPostSchema,
  CreateDiscussionReportSchema,
  DiscussionModerationCommentsQuerySchema,
  DiscussionModerationPostsQuerySchema,
  DiscussionModerationReportsQuerySchema,
  DiscussionPostCommentsQuerySchema,
  DiscussionPostListQuerySchema,
  MarkDiscussionSolvedSchema,
  ModerateDiscussionTargetSchema,
  ResolveDiscussionReportSchema,
  SetDiscussionBestCommentSchema,
  UpdateDiscussionCommentSchema,
  UpdateDiscussionPostSchema,
} from "@/server/modules/discussion-center/schemas"
import { DiscussionError } from "@/server/modules/discussion-center/shared"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

function mapErrorToResponse(error: unknown) {
  if (error instanceof DiscussionError) {
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

  console.error("[discussion-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "讨论服务暂时不可用，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleListDiscussionPosts(req: NextRequest) {
  try {
    const query = DiscussionPostListQuerySchema.parse(searchParamsToObject(new URL(req.url).searchParams))
    const result = await listDiscussionPosts(query)
    return jsonList(result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateDiscussionPost(req: NextRequest, user: AuthUser) {
  try {
    const body = CreateDiscussionPostSchema.parse(await req.json())
    const post = await createDiscussionPost(user, body)
    return jsonData(post, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGetDiscussionPost(id: string, user?: AuthUser | null) {
  try {
    const post = await getDiscussionPostDetail(id, user)
    if (!post) {
      return NextResponse.json({ error: "not_found", message: "讨论帖不存在" }, { status: 404 })
    }
    return jsonData(post)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleUpdateDiscussionPost(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = UpdateDiscussionPostSchema.parse(await req.json())
    const post = await updateDiscussionPost(id, user, body)
    return jsonData(post)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleDeleteDiscussionPost(id: string, user: AuthUser) {
  try {
    const result = await deleteDiscussionPost(id, user)
    return jsonData(result)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListDiscussionComments(req: NextRequest, postId: string, user?: AuthUser | null) {
  try {
    const query = DiscussionPostCommentsQuerySchema.parse(searchParamsToObject(new URL(req.url).searchParams))
    const result = await listDiscussionComments(postId, query, user)
    return jsonList(result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateDiscussionComment(req: NextRequest, postId: string, user: AuthUser) {
  try {
    const body = CreateDiscussionCommentSchema.parse(await req.json())
    const comment = await createDiscussionComment(user, postId, body)
    return jsonData(comment, { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleUpdateDiscussionComment(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = UpdateDiscussionCommentSchema.parse(await req.json())
    const comment = await updateDiscussionComment(id, user, body)
    return jsonData(comment)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleDeleteDiscussionComment(id: string, user: AuthUser) {
  try {
    const result = await deleteDiscussionComment(id, user)
    return jsonData(result)
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleLikeDiscussionPost(id: string, user: AuthUser) {
  try {
    return jsonData(await likeDiscussionPost(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleUnlikeDiscussionPost(id: string, user: AuthUser) {
  try {
    return jsonData(await unlikeDiscussionPost(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleLikeDiscussionComment(id: string, user: AuthUser) {
  try {
    return jsonData(await likeDiscussionComment(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleUnlikeDiscussionComment(id: string, user: AuthUser) {
  try {
    return jsonData(await unlikeDiscussionComment(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleFavoriteDiscussionPost(id: string, user: AuthUser) {
  try {
    return jsonData(await favoriteDiscussionPost(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleUnfavoriteDiscussionPost(id: string, user: AuthUser) {
  try {
    return jsonData(await unfavoriteDiscussionPost(user, id))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleCreateDiscussionReport(req: NextRequest, user: AuthUser) {
  try {
    const body = CreateDiscussionReportSchema.parse(await req.json())
    return jsonData(await createDiscussionReport(user, body), { status: 201 })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAuditDiscussionPost(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = AuditDiscussionTargetSchema.parse(await req.json())
    return jsonData(await auditDiscussionPost(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleAuditDiscussionComment(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = AuditDiscussionTargetSchema.parse(await req.json())
    return jsonData(await auditDiscussionComment(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleModerateDiscussionPost(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = ModerateDiscussionTargetSchema.parse(await req.json())
    return jsonData(await moderateDiscussionPost(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleModerateDiscussionComment(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = ModerateDiscussionTargetSchema.parse(await req.json())
    return jsonData(await moderateDiscussionComment(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleSetDiscussionBestComment(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = SetDiscussionBestCommentSchema.parse(await req.json())
    return jsonData(await setDiscussionBestComment(user, id, body.commentId))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleMarkDiscussionSolved(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = MarkDiscussionSolvedSchema.parse(await req.json())
    return jsonData(await markDiscussionPostSolved(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListDiscussionModerationPosts(req: NextRequest, user: AuthUser) {
  try {
    const query = DiscussionModerationPostsQuerySchema.parse(searchParamsToObject(new URL(req.url).searchParams))
    const result = await listDiscussionPostsForModeration(user, query)
    return jsonList(result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListDiscussionModerationComments(req: NextRequest, user: AuthUser) {
  try {
    const query = DiscussionModerationCommentsQuerySchema.parse(searchParamsToObject(new URL(req.url).searchParams))
    const result = await listDiscussionCommentsForModeration(user, query)
    return jsonList(result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleListDiscussionModerationReports(req: NextRequest, user: AuthUser) {
  try {
    const query = DiscussionModerationReportsQuerySchema.parse(searchParamsToObject(new URL(req.url).searchParams))
    const result = await listDiscussionReportsForModeration(user, query)
    return jsonList(result.items, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleResolveDiscussionReport(req: NextRequest, id: string, user: AuthUser) {
  try {
    const body = ResolveDiscussionReportSchema.parse(await req.json())
    return jsonData(await resolveDiscussionReport(user, id, body))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}
