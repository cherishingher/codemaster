import {
  type DiscussionAuditStatus,
  type DiscussionDisplayStatus,
  type DiscussionReportStatus,
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

const moderationPostArgs = Prisma.validator<Prisma.DiscussionPostDefaultArgs>()({
  include: {
    author: {
      select: {
        id: true,
        name: true,
      },
    },
    problem: {
      select: {
        id: true,
        title: true,
        slug: true,
      },
    },
    contest: {
      select: {
        id: true,
        name: true,
      },
    },
    tags: {
      include: {
        tag: {
          select: {
            id: true,
            tagName: true,
            tagSlug: true,
            tagType: true,
          },
        },
      },
    },
  },
})

const moderationCommentArgs = Prisma.validator<Prisma.DiscussionCommentDefaultArgs>()({
  include: {
    author: {
      select: {
        id: true,
        name: true,
      },
    },
    post: {
      select: {
        id: true,
        title: true,
        postType: true,
        problemId: true,
        contestId: true,
      },
    },
  },
})

type ModerationPostRecord = Prisma.DiscussionPostGetPayload<typeof moderationPostArgs>
type ModerationCommentRecord = Prisma.DiscussionCommentGetPayload<typeof moderationCommentArgs>

function mapModerationPost(post: ModerationPostRecord) {
  return {
    id: post.id,
    postType: post.postType,
    title: post.title,
    excerpt: post.excerpt,
    auditStatus: post.auditStatus,
    displayStatus: post.displayStatus,
    publishStatus: post.publishStatus,
    publishAt: post.publishAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    isDeleted: post.isDeleted,
    isPinned: post.isPinned,
    isFeatured: post.isFeatured,
    isRecommended: post.isRecommended,
    isSolved: post.isSolved,
    bestCommentId: post.bestCommentId,
    likeCount: post.likeCount,
    favoriteCount: post.favoriteCount,
    commentCount: post.commentCount,
    replyCount: post.replyCount,
    reportCount: post.reportCount,
    author: post.author,
    problem: post.problem,
    contest: post.contest,
    tags: post.tags.map((item) => item.tag),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

function mapModerationComment(comment: ModerationCommentRecord) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    rootCommentId: comment.rootCommentId,
    parentCommentId: comment.parentCommentId,
    replyToUserId: comment.replyToUserId,
    contentMarkdown: comment.contentMarkdown,
    contentPreview: comment.contentPlain?.slice(0, 160) ?? null,
    depth: comment.depth,
    floorNo: comment.floorNo,
    auditStatus: comment.auditStatus,
    displayStatus: comment.displayStatus,
    isDeleted: comment.isDeleted,
    likeCount: comment.likeCount,
    replyCount: comment.replyCount,
    reportCount: comment.reportCount,
    author: comment.author,
    post: comment.post,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

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

export async function listDiscussionPostsForModeration(
  user: AuthUser,
  query: {
    keyword?: string
    postType?: DiscussionPostType
    auditStatus?: DiscussionAuditStatus
    displayStatus?: DiscussionDisplayStatus
    page: number
    pageSize: number
  },
) {
  assertDiscussionModerator(user)

  const where: Prisma.DiscussionPostWhereInput = {
    ...(query.postType ? { postType: query.postType } : {}),
    ...(query.auditStatus ? { auditStatus: query.auditStatus } : {}),
    ...(query.displayStatus ? { displayStatus: query.displayStatus } : {}),
    ...(query.keyword
      ? {
          OR: [
            { title: { contains: query.keyword, mode: "insensitive" } },
            { contentPlain: { contains: query.keyword, mode: "insensitive" } },
            { excerpt: { contains: query.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.discussionPost.findMany({
      where,
      ...moderationPostArgs,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.discussionPost.count({ where }),
  ])

  return {
    items: rows.map(mapModerationPost),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export async function listDiscussionCommentsForModeration(
  user: AuthUser,
  query: {
    keyword?: string
    auditStatus?: DiscussionAuditStatus
    displayStatus?: DiscussionDisplayStatus
    postId?: string
    page: number
    pageSize: number
  },
) {
  assertDiscussionModerator(user)

  const where: Prisma.DiscussionCommentWhereInput = {
    ...(query.auditStatus ? { auditStatus: query.auditStatus } : {}),
    ...(query.displayStatus ? { displayStatus: query.displayStatus } : {}),
    ...(query.postId ? { postId: query.postId } : {}),
    ...(query.keyword
      ? {
          OR: [{ contentPlain: { contains: query.keyword, mode: "insensitive" } }],
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    db.discussionComment.findMany({
      where,
      ...moderationCommentArgs,
      orderBy: [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.discussionComment.count({ where }),
  ])

  return {
    items: rows.map(mapModerationComment),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export async function listDiscussionReportsForModeration(
  user: AuthUser,
  query: {
    status?: DiscussionReportStatus
    targetType?: "post" | "comment"
    page: number
    pageSize: number
  },
) {
  assertDiscussionModerator(user)

  const where: Prisma.DiscussionReportWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
  }

  const [reports, total] = await Promise.all([
    db.discussionReport.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.discussionReport.count({ where }),
  ])

  const reporterIds = Array.from(new Set(reports.map((item) => item.reporterId)))
  const postIds = reports.filter((item) => item.targetType === "post").map((item) => item.targetId)
  const commentIds = reports.filter((item) => item.targetType === "comment").map((item) => item.targetId)

  const [reporters, posts, comments] = await Promise.all([
    reporterIds.length
      ? db.user.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, name: true },
        })
      : [],
    postIds.length
      ? db.discussionPost.findMany({
          where: { id: { in: postIds } },
          select: {
            id: true,
            title: true,
            excerpt: true,
            auditStatus: true,
            displayStatus: true,
          },
        })
      : [],
    commentIds.length
      ? db.discussionComment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            contentPlain: true,
            auditStatus: true,
            displayStatus: true,
            post: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : [],
  ])

  const reporterMap = new Map(reporters.map((item) => [item.id, item]))
  const postMap = new Map(posts.map((item) => [item.id, item]))
  const commentMap = new Map(comments.map((item) => [item.id, item]))

  return {
    items: reports.map((report) => {
      const targetPreview =
        report.targetType === "post"
          ? (() => {
              const target = postMap.get(report.targetId)
              return target
                ? {
                    title: target.title,
                    excerpt: target.excerpt,
                    auditStatus: target.auditStatus,
                    displayStatus: target.displayStatus,
                  }
                : null
            })()
          : (() => {
              const target = commentMap.get(report.targetId)
              return target
                ? {
                    title: target.post.title,
                    excerpt: target.contentPlain?.slice(0, 160) ?? null,
                    auditStatus: target.auditStatus,
                    displayStatus: target.displayStatus,
                    postId: target.post.id,
                  }
                : null
            })()

      return {
        id: report.id,
        reporter: reporterMap.get(report.reporterId) ?? null,
        targetType: report.targetType,
        targetId: report.targetId,
        reasonCode: report.reasonCode,
        reasonText: report.reasonText,
        status: report.status,
        handledById: report.handledById,
        handledAt: report.handledAt?.toISOString() ?? null,
        resultNote: report.resultNote,
        targetPreview,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      }
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export async function resolveDiscussionReport(
  user: AuthUser,
  reportId: string,
  input: {
    status: DiscussionReportStatus
    resultNote?: string | null
  },
) {
  assertDiscussionModerator(user)

  const report = await db.discussionReport.findUnique({
    where: { id: reportId },
    select: { id: true },
  })

  if (!report) {
    throw new DiscussionError("report_not_found", "举报记录不存在", 404)
  }

  return db.discussionReport.update({
    where: { id: reportId },
    data: {
      status: input.status,
      resultNote: input.resultNote ?? null,
      handledById: user.id,
      handledAt: new Date(),
    },
  })
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
