import {
  type DiscussionAuditStatus,
  DiscussionModerationActionType,
  DiscussionPostType,
  Prisma,
} from "@prisma/client"
import type { AuthUser } from "@/lib/authz"
import { db } from "@/lib/db"
import {
  DiscussionError,
  assertDiscussionModerator,
  ensureDiscussionOwnerOrModerator,
} from "@/server/modules/discussion-center/shared"

export async function auditDiscussionPost(
  user: AuthUser,
  postId: string,
  input: {
    auditStatus: DiscussionAuditStatus
    reason?: string | null
  },
) {
  assertDiscussionModerator(user)

  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: { id: true, metadata: true },
  })

  if (!post) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        auditStatus: input.auditStatus,
        metadata: {
          ...(typeof post.metadata === "object" && post.metadata ? post.metadata : {}),
          lastAuditReason: input.reason ?? null,
        } as Prisma.InputJsonValue,
      },
    })

    await tx.discussionAuditLog.create({
      data: {
        targetType: "post",
        targetId: postId,
        auditStatus: input.auditStatus,
        operatorId: user.id,
        reason: input.reason ?? null,
      },
    })

    return updated
  })
}

export async function auditDiscussionComment(
  user: AuthUser,
  commentId: string,
  input: {
    auditStatus: DiscussionAuditStatus
    reason?: string | null
  },
) {
  assertDiscussionModerator(user)

  const comment = await db.discussionComment.findUnique({
    where: { id: commentId },
    select: { id: true },
  })

  if (!comment) {
    throw new DiscussionError("comment_not_found", "评论不存在", 404)
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionComment.update({
      where: { id: commentId },
      data: {
        auditStatus: input.auditStatus,
      },
    })

    await tx.discussionAuditLog.create({
      data: {
        targetType: "comment",
        targetId: commentId,
        auditStatus: input.auditStatus,
        operatorId: user.id,
        reason: input.reason ?? null,
      },
    })

    return updated
  })
}

function mapPostModerationAction(actionType: DiscussionModerationActionType, operatorId: string) {
  const map: Record<string, Prisma.DiscussionPostUpdateInput> = {
    approve: { auditStatus: "approved" },
    reject: { auditStatus: "rejected" },
    hide: { displayStatus: "hidden" },
    unhide: { displayStatus: "visible" },
    lock: { isLocked: true },
    unlock: { isLocked: false },
    pin: { isPinned: true, pinScope: "global" },
    unpin: { isPinned: false, pinScope: "none" },
    feature: { isFeatured: true },
    unfeature: { isFeatured: false },
    recommend: { isRecommended: true },
    unrecommend: { isRecommended: false },
    delete: { isDeleted: true, deletedAt: new Date(), deletedBy: operatorId },
    restore: { isDeleted: false, deletedAt: null, deletedBy: null },
  }

  const data = map[actionType]
  if (!data) {
    throw new DiscussionError("unsupported_action", "该帖子管理动作暂不支持", 400)
  }
  return data
}

function mapCommentModerationAction(actionType: DiscussionModerationActionType, operatorId: string) {
  const map: Record<string, Prisma.DiscussionCommentUpdateInput> = {
    approve: { auditStatus: "approved" },
    reject: { auditStatus: "rejected" },
    hide: { displayStatus: "hidden" },
    unhide: { displayStatus: "visible" },
    delete: { isDeleted: true, deletedAt: new Date(), deletedBy: operatorId },
    restore: { isDeleted: false, deletedAt: null, deletedBy: null },
  }

  const data = map[actionType]
  if (!data) {
    throw new DiscussionError("unsupported_action", "该评论管理动作暂不支持", 400)
  }
  return data
}

export async function moderateDiscussionPost(
  user: AuthUser,
  postId: string,
  input: {
    actionType: DiscussionModerationActionType
    reason?: string | null
  },
) {
  assertDiscussionModerator(user)
  const data = mapPostModerationAction(input.actionType, user.id)

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data,
    })

    await tx.discussionModerationAction.create({
      data: {
        targetType: "post",
        targetId: postId,
        actionType: input.actionType,
        operatorId: user.id,
        reason: input.reason ?? null,
      },
    })

    return updated
  })
}

export async function moderateDiscussionComment(
  user: AuthUser,
  commentId: string,
  input: {
    actionType: DiscussionModerationActionType
    reason?: string | null
  },
) {
  assertDiscussionModerator(user)
  const data = mapCommentModerationAction(input.actionType, user.id)

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionComment.update({
      where: { id: commentId },
      data,
    })

    await tx.discussionModerationAction.create({
      data: {
        targetType: "comment",
        targetId: commentId,
        actionType: input.actionType,
        operatorId: user.id,
        reason: input.reason ?? null,
      },
    })

    return updated
  })
}

export async function setDiscussionBestComment(
  user: AuthUser,
  postId: string,
  commentId: string,
) {
  const [post, comment] = await Promise.all([
    db.discussionPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        postType: true,
        isDeleted: true,
      },
    }),
    db.discussionComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        isDeleted: true,
      },
    }),
  ])

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  if (!comment || comment.isDeleted || comment.postId !== postId) {
    throw new DiscussionError("comment_not_found", "评论不存在", 404)
  }

  if (post.postType !== DiscussionPostType.question) {
    throw new DiscussionError("best_comment_invalid", "只有问答帖可以设置最佳回复", 400)
  }

  ensureDiscussionOwnerOrModerator(post.authorId, user)

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        bestCommentId: commentId,
        acceptedById: user.id,
        isSolved: true,
        solvedAt: new Date(),
      },
    })

    await tx.discussionModerationAction.create({
      data: {
        targetType: "post",
        targetId: postId,
        actionType: "mark_best_comment",
        operatorId: user.id,
        reason: `best comment ${commentId}`,
      },
    })

    return updated
  })
}

export async function markDiscussionPostSolved(
  user: AuthUser,
  postId: string,
  input: { isSolved: boolean },
) {
  const post = await db.discussionPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      postType: true,
      isDeleted: true,
    },
  })

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  if (post.postType !== DiscussionPostType.question) {
    throw new DiscussionError("solved_invalid", "只有问答帖可以标记已解决", 400)
  }

  ensureDiscussionOwnerOrModerator(post.authorId, user)

  return db.$transaction(async (tx) => {
    const updated = await tx.discussionPost.update({
      where: { id: postId },
      data: {
        isSolved: input.isSolved,
        solvedAt: input.isSolved ? new Date() : null,
        acceptedById: input.isSolved ? user.id : null,
      },
    })

    await tx.discussionModerationAction.create({
      data: {
        targetType: "post",
        targetId: postId,
        actionType: input.isSolved ? "mark_solved" : "unmark_solved",
        operatorId: user.id,
      },
    })

    return updated
  })
}
