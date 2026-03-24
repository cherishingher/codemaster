import { DiscussionPostType, Prisma } from "@prisma/client"
import type { AuthUser } from "@/lib/authz"
import { db } from "@/lib/db"
import {
  DiscussionError,
  ensureDiscussionOwnerOrModerator,
  findActiveContestForProblem,
  isDiscussionModerator,
  toDiscussionExcerpt,
  toDiscussionPlainText,
} from "@/server/modules/discussion-center/shared"

const discussionPostListArgs = Prisma.validator<Prisma.DiscussionPostDefaultArgs>()({
  include: {
    author: {
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

type DiscussionPostRecord = Prisma.DiscussionPostGetPayload<typeof discussionPostListArgs>

function mapDiscussionPost(post: DiscussionPostRecord) {
  return {
    id: post.id,
    postType: post.postType,
    title: post.title,
    excerpt: post.excerpt,
    contentMarkdown: post.contentMarkdown,
    problemId: post.problemId,
    contestId: post.contestId,
    auditStatus: post.auditStatus,
    displayStatus: post.displayStatus,
    publishStatus: post.publishStatus,
    publishAt: post.publishAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    isPinned: post.isPinned,
    isFeatured: post.isFeatured,
    isRecommended: post.isRecommended,
    isSolved: post.isSolved,
    bestCommentId: post.bestCommentId,
    commentCount: post.commentCount,
    replyCount: post.replyCount,
    likeCount: post.likeCount,
    favoriteCount: post.favoriteCount,
    viewCount: post.viewCount,
    reportCount: post.reportCount,
    hotScore: Number(post.hotScore),
    lastCommentAt: post.lastCommentAt?.toISOString() ?? null,
    author: {
      id: post.author.id,
      name: post.author.name,
    },
    tags: post.tags.map((item) => item.tag),
    viewerState: {
      liked: false,
      favorited: false,
    },
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

async function syncTagCountsInTx(tx: Prisma.TransactionClient, tagIds: string[], delta: 1 | -1) {
  if (tagIds.length === 0) return
  await Promise.all(
    tagIds.map((tagId) =>
      tx.discussionTag.update({
        where: { id: tagId },
        data: {
          postCount: {
            increment: delta,
          },
        },
      }),
    ),
  )
}

function normalizeTagIds(tagIds?: string[] | null) {
  return Array.from(new Set((tagIds ?? []).filter(Boolean)))
}

async function ensureDiscussionTagsExist(tagIds: string[]) {
  if (tagIds.length === 0) return

  const rows = await db.discussionTag.findMany({
    where: {
      id: { in: tagIds },
      status: "active",
    },
    select: { id: true },
  })

  if (rows.length !== tagIds.length) {
    throw new DiscussionError("tag_not_found", "存在无效的讨论标签", 400)
  }
}

function getPublicWhere(now: Date): Prisma.DiscussionPostWhereInput {
  return {
    auditStatus: "approved",
    displayStatus: "visible",
    isDeleted: false,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  }
}

async function resolveCreatePolicy(
  user: AuthUser,
  input: {
    postType: DiscussionPostType
    problemId?: string | null
    contestId?: string | null
  },
) {
  const isModerator = isDiscussionModerator(user)

  if (
    (input.postType === DiscussionPostType.problem_discussion || input.postType === DiscussionPostType.solution) &&
    input.problemId
  ) {
    const activeContest = await findActiveContestForProblem(input.problemId)

    if (input.postType === DiscussionPostType.problem_discussion && activeContest && !isModerator) {
      throw new DiscussionError("contest_spoiler_blocked", "比赛进行中，暂不允许发布该题目的讨论帖", 403)
    }

    if (input.postType === DiscussionPostType.solution && activeContest) {
      return {
        auditStatus: "approved" as const,
        publishStatus: "delayed_by_contest" as const,
        publishAt: activeContest.endAt,
      }
    }
  }

  if (input.postType === DiscussionPostType.contest_discussion && input.contestId && !isModerator) {
    const contest = await db.contest.findUnique({
      where: { id: input.contestId },
      select: { id: true, startAt: true, endAt: true },
    })

    if (contest) {
      const now = new Date()
      if (contest.startAt <= now && contest.endAt >= now) {
        return {
          auditStatus: "manual_review" as const,
          publishStatus: "immediate" as const,
          publishAt: null,
        }
      }
    }
  }

  return {
    auditStatus: "approved" as const,
    publishStatus: "immediate" as const,
    publishAt: null,
  }
}

export async function listDiscussionPosts(query: {
  keyword?: string
  postType?: DiscussionPostType
  problemId?: string
  contestId?: string
  tagId?: string
  authorId?: string
  sort: "newest" | "hot" | "featured" | "unsolved"
  page: number
  pageSize: number
}) {
  const now = new Date()
  const where: Prisma.DiscussionPostWhereInput = {
    ...getPublicWhere(now),
    ...(query.postType ? { postType: query.postType } : {}),
    ...(query.problemId ? { problemId: query.problemId } : {}),
    ...(query.contestId ? { contestId: query.contestId } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
    ...(query.keyword
      ? {
          OR: [
            { title: { contains: query.keyword, mode: "insensitive" } },
            { excerpt: { contains: query.keyword, mode: "insensitive" } },
            { contentPlain: { contains: query.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const orderBy =
    query.sort === "hot"
      ? [{ hotScore: "desc" as const }, { createdAt: "desc" as const }]
      : query.sort === "featured"
        ? [{ isPinned: "desc" as const }, { isFeatured: "desc" as const }, { createdAt: "desc" as const }]
        : query.sort === "unsolved"
          ? [{ isSolved: "asc" as const }, { lastCommentAt: "desc" as const }, { createdAt: "desc" as const }]
          : [{ createdAt: "desc" as const }]

  const [posts, total] = await Promise.all([
    db.discussionPost.findMany({
      where,
      ...discussionPostListArgs,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.discussionPost.count({ where }),
  ])

  return {
    items: posts.map(mapDiscussionPost),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  }
}

export async function getDiscussionPostDetail(id: string, viewer?: AuthUser | null) {
  const now = new Date()
  const post = await db.discussionPost.findUnique({
    where: { id },
    ...discussionPostListArgs,
  })

  if (!post || post.isDeleted) return null

  const canViewHidden = viewer && (viewer.id === post.authorId || isDiscussionModerator(viewer))
  const isPublicVisible =
    post.auditStatus === "approved" &&
    post.displayStatus === "visible" &&
    (!post.publishAt || post.publishAt <= now)

  if (!isPublicVisible && !canViewHidden) {
    return null
  }

  if (isPublicVisible) {
    await db.discussionPost.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })
  }

  const [liked, favorited] =
    viewer
      ? await Promise.all([
          db.discussionPostLike.findUnique({
            where: {
              postId_userId: {
                postId: id,
                userId: viewer.id,
              },
            },
            select: { postId: true },
          }),
          db.discussionPostFavorite.findUnique({
            where: {
              postId_userId: {
                postId: id,
                userId: viewer.id,
              },
            },
            select: { postId: true },
          }),
        ])
      : [null, null]

  return {
    ...mapDiscussionPost(post),
    viewerState: {
      liked: Boolean(liked),
      favorited: Boolean(favorited),
    },
  }
}

export async function createDiscussionPost(
  user: AuthUser,
  input: {
    postType: DiscussionPostType
    title: string
    contentMarkdown: string
    problemId?: string | null
    contestId?: string | null
    tagIds?: string[]
  },
) {
  const tagIds = normalizeTagIds(input.tagIds)

  if (input.postType === DiscussionPostType.announcement && !isDiscussionModerator(user)) {
    throw new DiscussionError("forbidden", "只有管理员可以发布公告帖", 403)
  }

  if (
    [DiscussionPostType.problem_discussion, DiscussionPostType.solution].includes(input.postType) &&
    !input.problemId
  ) {
    throw new DiscussionError("binding_invalid", "题目讨论和题解必须绑定题目", 400)
  }

  if (input.postType === DiscussionPostType.contest_discussion && !input.contestId) {
    throw new DiscussionError("binding_invalid", "比赛讨论必须绑定比赛", 400)
  }

  if (
    [DiscussionPostType.problem_discussion, DiscussionPostType.solution].includes(input.postType) &&
    input.contestId
  ) {
    throw new DiscussionError("binding_invalid", "题目讨论和题解不能直接绑定比赛", 400)
  }

  if (input.postType === DiscussionPostType.contest_discussion && input.problemId) {
    throw new DiscussionError("binding_invalid", "比赛讨论不能直接绑定题目", 400)
  }

  const policy = await resolveCreatePolicy(user, input)
  await ensureDiscussionTagsExist(tagIds)

  return db.$transaction(async (tx) => {
    const post = await tx.discussionPost.create({
      data: {
        authorId: user.id,
        postType: input.postType,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        contentPlain: toDiscussionPlainText(input.contentMarkdown),
        excerpt: toDiscussionExcerpt(input.contentMarkdown),
        problemId: input.problemId ?? null,
        contestId: input.contestId ?? null,
        auditStatus: policy.auditStatus,
        displayStatus: "visible",
        publishStatus: policy.publishStatus,
        publishAt: policy.publishAt,
      },
    })

    if (tagIds.length > 0) {
      await tx.discussionPostTag.createMany({
        data: tagIds.map((tagId) => ({
          postId: post.id,
          tagId,
        })),
        skipDuplicates: true,
      })

      await syncTagCountsInTx(tx, tagIds, 1)
    }

    return tx.discussionPost.findUnique({
      where: { id: post.id },
      ...discussionPostListArgs,
    })
  })
}

export async function updateDiscussionPost(
  id: string,
  user: AuthUser,
  input: {
    title?: string
    contentMarkdown?: string
    tagIds?: string[]
  },
) {
  const nextTagIds = input.tagIds ? normalizeTagIds(input.tagIds) : undefined
  const post = await db.discussionPost.findUnique({
    where: { id },
    include: {
      tags: true,
    },
  })

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  ensureDiscussionOwnerOrModerator(post.authorId, user)

  if (post.isLocked && user.id === post.authorId && !isDiscussionModerator(user)) {
    throw new DiscussionError("post_locked", "锁帖后不能再修改帖子", 403)
  }

  if (nextTagIds) {
    await ensureDiscussionTagsExist(nextTagIds)
  }

  return db.$transaction(async (tx) => {
    await tx.discussionPost.update({
      where: { id },
      data: {
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        contentPlain: input.contentMarkdown ? toDiscussionPlainText(input.contentMarkdown) : undefined,
        excerpt: input.contentMarkdown ? toDiscussionExcerpt(input.contentMarkdown) : undefined,
      },
    })

    if (nextTagIds) {
      const existingTagIds = post.tags.map((item) => item.tagId)
      await tx.discussionPostTag.deleteMany({ where: { postId: id } })

      if (existingTagIds.length > 0) {
        await syncTagCountsInTx(tx, existingTagIds, -1)
      }

      if (nextTagIds.length > 0) {
        await tx.discussionPostTag.createMany({
          data: nextTagIds.map((tagId) => ({ postId: id, tagId })),
          skipDuplicates: true,
        })

        await syncTagCountsInTx(tx, nextTagIds, 1)
      }
    }

    const updated = await tx.discussionPost.findUnique({
      where: { id },
      ...discussionPostListArgs,
    })

    return updated ? mapDiscussionPost(updated) : null
  })
}

export async function deleteDiscussionPost(id: string, user: AuthUser) {
  const post = await db.discussionPost.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      isDeleted: true,
    },
  })

  if (!post || post.isDeleted) {
    throw new DiscussionError("post_not_found", "讨论帖不存在", 404)
  }

  ensureDiscussionOwnerOrModerator(post.authorId, user)

  await db.discussionPost.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user.id,
    },
  })

  return { success: true }
}
