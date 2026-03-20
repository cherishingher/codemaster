import { type DiscussionReportReasonCode, type DiscussionTargetType } from "@prisma/client"
import type { AuthUser } from "@/lib/authz"
import { db } from "@/lib/db"
import { DiscussionError } from "@/server/modules/discussion-center/shared"

async function ensureDiscussionPostExists(postId: string) {
  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: { id: true, isDeleted: true, likeCount: true, favoriteCount: true },
  })

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  return post
}

async function ensureDiscussionCommentExists(commentId: string) {
  const comment = await db.discussionComment.findUnique({
    where: { id: commentId },
    select: { id: true, isDeleted: true, likeCount: true },
  })

  if (!comment || comment.isDeleted) {
    throw new DiscussionError("comment_not_found", "评论不存在", 404)
  }

  return comment
}

export async function likeDiscussionPost(user: AuthUser, postId: string) {
  const post = await ensureDiscussionPostExists(postId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionPostLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return { liked: true, likeCount: post.likeCount }
    }

    await tx.discussionPostLike.create({
      data: {
        postId,
        userId: user.id,
      },
    })

    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        likeCount: {
          increment: 1,
        },
      },
      select: { likeCount: true },
    })

    return { liked: true, likeCount: updated.likeCount }
  })
}

export async function unlikeDiscussionPost(user: AuthUser, postId: string) {
  const post = await ensureDiscussionPostExists(postId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionPostLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (!existing) {
      return { liked: false, likeCount: post.likeCount }
    }

    await tx.discussionPostLike.delete({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
      select: { likeCount: true },
    })

    return { liked: false, likeCount: updated.likeCount }
  })
}

export async function likeDiscussionComment(user: AuthUser, commentId: string) {
  const comment = await ensureDiscussionCommentExists(commentId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return { liked: true, likeCount: comment.likeCount }
    }

    await tx.discussionCommentLike.create({
      data: {
        commentId,
        userId: user.id,
      },
    })

    const updated = await tx.discussionComment.update({
      where: { id: commentId },
      data: {
        likeCount: {
          increment: 1,
        },
      },
      select: { likeCount: true },
    })

    return { liked: true, likeCount: updated.likeCount }
  })
}

export async function unlikeDiscussionComment(user: AuthUser, commentId: string) {
  const comment = await ensureDiscussionCommentExists(commentId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: user.id,
        },
      },
    })

    if (!existing) {
      return { liked: false, likeCount: comment.likeCount }
    }

    await tx.discussionCommentLike.delete({
      where: {
        commentId_userId: {
          commentId,
          userId: user.id,
        },
      },
    })

    const updated = await tx.discussionComment.update({
      where: { id: commentId },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
      select: { likeCount: true },
    })

    return { liked: false, likeCount: updated.likeCount }
  })
}

export async function favoriteDiscussionPost(user: AuthUser, postId: string) {
  const post = await ensureDiscussionPostExists(postId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionPostFavorite.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return { favorited: true, favoriteCount: post.favoriteCount }
    }

    await tx.discussionPostFavorite.create({
      data: {
        postId,
        userId: user.id,
      },
    })

    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        favoriteCount: {
          increment: 1,
        },
      },
      select: { favoriteCount: true },
    })

    return { favorited: true, favoriteCount: updated.favoriteCount }
  })
}

export async function unfavoriteDiscussionPost(user: AuthUser, postId: string) {
  const post = await ensureDiscussionPostExists(postId)

  return db.$transaction(async (tx) => {
    const existing = await tx.discussionPostFavorite.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    if (!existing) {
      return { favorited: false, favoriteCount: post.favoriteCount }
    }

    await tx.discussionPostFavorite.delete({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    })

    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        favoriteCount: {
          decrement: 1,
        },
      },
      select: { favoriteCount: true },
    })

    return { favorited: false, favoriteCount: updated.favoriteCount }
  })
}

export async function createDiscussionReport(
  user: AuthUser,
  input: {
    targetType: DiscussionTargetType
    targetId: string
    reasonCode: DiscussionReportReasonCode
    reasonText?: string | null
  },
) {
  const existing = await db.discussionReport.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
  })

  if (existing) {
    throw new DiscussionError("duplicate_report", "你已经举报过这条内容", 409)
  }

  if (input.targetType === "post") {
    await ensureDiscussionPostExists(input.targetId)
  } else {
    await ensureDiscussionCommentExists(input.targetId)
  }

  return db.$transaction(async (tx) => {
    const report = await tx.discussionReport.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reasonCode: input.reasonCode,
        reasonText: input.reasonText ?? null,
      },
    })

    if (input.targetType === "post") {
      await tx.discussionPost.update({
        where: { id: input.targetId },
        data: {
          reportCount: {
            increment: 1,
          },
        },
      })
    } else {
      await tx.discussionComment.update({
        where: { id: input.targetId },
        data: {
          reportCount: {
            increment: 1,
          },
        },
      })
    }

    return {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }
  })
}
