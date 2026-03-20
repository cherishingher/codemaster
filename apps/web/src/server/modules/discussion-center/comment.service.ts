import type { AuthUser } from "@/lib/authz"
import { db } from "@/lib/db"
import {
  DiscussionError,
  ensureDiscussionOwnerOrModerator,
  toDiscussionPlainText,
} from "@/server/modules/discussion-center/shared"

function mapDiscussionComment(comment: {
  id: string
  postId: string
  authorId: string
  rootCommentId: string | null
  parentCommentId: string | null
  replyToUserId: string | null
  contentMarkdown: string
  depth: number
  floorNo: number
  likeCount: number
  replyCount: number
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string | null }
}, viewerLiked = false) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    rootCommentId: comment.rootCommentId,
    parentCommentId: comment.parentCommentId,
    replyToUserId: comment.replyToUserId,
    contentMarkdown: comment.contentMarkdown,
    depth: comment.depth,
    floorNo: comment.floorNo,
    likeCount: comment.likeCount,
    replyCount: comment.replyCount,
    author: {
      id: comment.author.id,
      name: comment.author.name,
    },
    viewerLiked,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

export async function listDiscussionComments(
  postId: string,
  query: { page: number; pageSize: number },
  viewer?: AuthUser | null,
) {
  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      isDeleted: true,
      auditStatus: true,
      displayStatus: true,
    },
  })

  if (!post || post.isDeleted || post.auditStatus !== "approved" || post.displayStatus !== "visible") {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  const rootWhere = {
    postId,
    depth: 1,
    auditStatus: "approved" as const,
    displayStatus: "visible" as const,
    isDeleted: false,
  }

  const [roots, total] = await Promise.all([
    db.discussionComment.findMany({
      where: rootWhere,
      orderBy: { createdAt: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.discussionComment.count({ where: rootWhere }),
  ])

  const rootIds = roots.map((item) => item.id)
  const replies =
    rootIds.length > 0
      ? await db.discussionComment.findMany({
          where: {
            postId,
            rootCommentId: { in: rootIds },
            depth: 2,
            auditStatus: "approved",
            displayStatus: "visible",
            isDeleted: false,
          },
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : []

  const commentIds = [...roots.map((item) => item.id), ...replies.map((item) => item.id)]
  const likedIdSet =
    viewer && commentIds.length > 0
      ? new Set(
          (
            await db.discussionCommentLike.findMany({
              where: {
                userId: viewer.id,
                commentId: { in: commentIds },
              },
              select: {
                commentId: true,
              },
            })
          ).map((item) => item.commentId),
        )
      : new Set<string>()

  const replyMap = new Map<string, ReturnType<typeof mapDiscussionComment>[]>()
  for (const reply of replies) {
    const key = reply.rootCommentId!
    const list = replyMap.get(key) ?? []
    list.push(mapDiscussionComment(reply, likedIdSet.has(reply.id)))
    replyMap.set(key, list)
  }

  return {
    items: roots.map((root) => ({
      ...mapDiscussionComment(root, likedIdSet.has(root.id)),
      replies: replyMap.get(root.id) ?? [],
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export async function createDiscussionComment(
  user: AuthUser,
  postId: string,
  input: {
    contentMarkdown: string
    parentCommentId?: string | null
    replyToUserId?: string | null
  },
) {
  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      isDeleted: true,
      isLocked: true,
      auditStatus: true,
      displayStatus: true,
    },
  })

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  if (post.isLocked) {
    throw new DiscussionError("post_locked", "该帖子已锁定，不能继续评论", 403)
  }

  if (post.auditStatus !== "approved" || post.displayStatus !== "visible") {
    throw new DiscussionError("post_not_commentable", "当前帖子不可评论", 403)
  }

  let depth = 1
  let rootCommentId: string | null = null

  if (input.parentCommentId) {
    const parent = await db.discussionComment.findUnique({
      where: { id: input.parentCommentId },
      select: {
        id: true,
        postId: true,
        depth: true,
        rootCommentId: true,
        isDeleted: true,
      },
    })

    if (!parent || parent.isDeleted || parent.postId !== postId) {
      throw new DiscussionError("comment_not_found", "回复的评论不存在", 404)
    }

    if (parent.depth >= 2) {
      throw new DiscussionError("reply_depth_exceeded", "评论最多支持两层", 400)
    }

    depth = 2
    rootCommentId = parent.rootCommentId ?? parent.id
  }

  return db.$transaction(async (tx) => {
    const floorNo =
      depth === 1
        ? (await tx.discussionComment.count({
            where: {
              postId,
              depth: 1,
              isDeleted: false,
            },
          })) + 1
        : 0

    const comment = await tx.discussionComment.create({
      data: {
        postId,
        authorId: user.id,
        rootCommentId,
        parentCommentId: input.parentCommentId ?? null,
        replyToUserId: input.replyToUserId ?? null,
        contentMarkdown: input.contentMarkdown,
        contentPlain: toDiscussionPlainText(input.contentMarkdown),
        depth,
        floorNo,
        auditStatus: "approved",
        displayStatus: "visible",
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await tx.discussionPost.update({
      where: { id: postId },
      data: {
        commentCount: depth === 1 ? { increment: 1 } : undefined,
        replyCount: depth === 2 ? { increment: 1 } : undefined,
        lastCommentAt: new Date(),
        lastCommentUserId: user.id,
      },
    })

    if (depth === 2 && input.parentCommentId) {
      await tx.discussionComment.update({
        where: { id: input.parentCommentId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })
    }

    return mapDiscussionComment(comment)
  })
}

export async function updateDiscussionComment(
  id: string,
  user: AuthUser,
  input: { contentMarkdown: string },
) {
  const comment = await db.discussionComment.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      isDeleted: true,
    },
  })

  if (!comment || comment.isDeleted) {
    throw new DiscussionError("comment_not_found", "评论不存在", 404)
  }

  ensureDiscussionOwnerOrModerator(comment.authorId, user)

  const updated = await db.discussionComment.update({
    where: { id },
    data: {
      contentMarkdown: input.contentMarkdown,
      contentPlain: toDiscussionPlainText(input.contentMarkdown),
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return mapDiscussionComment(updated)
}

export async function deleteDiscussionComment(id: string, user: AuthUser) {
  const comment = await db.discussionComment.findUnique({
    where: { id },
    select: {
      id: true,
      postId: true,
      authorId: true,
      depth: true,
      parentCommentId: true,
      isDeleted: true,
    },
  })

  if (!comment || comment.isDeleted) {
    throw new DiscussionError("comment_not_found", "评论不存在", 404)
  }

  ensureDiscussionOwnerOrModerator(comment.authorId, user)

  await db.$transaction(async (tx) => {
    await tx.discussionComment.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    })

    await tx.discussionPost.update({
      where: { id: comment.postId },
      data: {
        commentCount: comment.depth === 1 ? { decrement: 1 } : undefined,
        replyCount: comment.depth === 2 ? { decrement: 1 } : undefined,
      },
    })

    if (comment.depth === 2 && comment.parentCommentId) {
      await tx.discussionComment.update({
        where: { id: comment.parentCommentId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
      })
    }
  })

  return { success: true }
}
