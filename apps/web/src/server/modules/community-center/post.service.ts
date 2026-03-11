import { Prisma } from "@prisma/client"
import type {
  CommunityCommentItem,
  CommunityPostDetailItem,
  CommunityPostItem,
  CommunityPostKind,
} from "@/lib/community"
import { db } from "@/lib/db"
import { awardPointsInTx } from "@/server/modules/community-center/points.service"
import { CommunityError } from "@/server/modules/community-center/shared"

type Viewer = {
  id?: string | null
  roles?: string[]
}

const postArgs = Prisma.validator<Prisma.PostDefaultArgs>()({
  include: {
    user: {
      select: {
        id: true,
        name: true,
      },
    },
    group: {
      select: {
        id: true,
        slug: true,
        name: true,
      },
    },
    _count: {
      select: {
        comments: true,
      },
    },
  },
})

type PostRecord = Prisma.PostGetPayload<typeof postArgs>

function mapPost(post: PostRecord): CommunityPostItem {
  return {
    id: post.id,
    kind: post.kind as CommunityPostKind,
    groupId: post.groupId,
    title: post.title,
    content: post.content,
    status: post.status,
    visibility: post.visibility,
    author: {
      id: post.user.id,
      name: post.user.name,
    },
    group: post.group
      ? {
          id: post.group.id,
          slug: post.group.slug,
          name: post.group.name,
        }
      : null,
    commentCount: post._count.comments,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

function mapComment(comment: {
  id: string
  content: string
  createdAt: Date
  user: { id: string; name: string | null }
}): CommunityCommentItem {
  return {
    id: comment.id,
    content: comment.content,
    author: {
      id: comment.user.id,
      name: comment.user.name,
    },
    createdAt: comment.createdAt.toISOString(),
  }
}

function getPostPoints(kind: CommunityPostKind) {
  switch (kind) {
    case "achievement":
      return 20
    case "activity":
      return 12
    case "question":
      return 10
    default:
      return 15
  }
}

export async function listCommunityFeed(query?: { groupId?: string | null; kind?: string | null }) {
  const posts = await db.post.findMany({
    where: {
      status: "approved",
      visibility: "public",
      ...(query?.groupId ? { groupId: query.groupId } : {}),
      ...(query?.kind ? { kind: query.kind } : {}),
    },
    ...postArgs,
    orderBy: { createdAt: "desc" },
    take: 40,
  })

  return posts.map(mapPost)
}

export async function getCommunityPostDetail(id: string, viewer?: Viewer): Promise<CommunityPostDetailItem | null> {
  const isAdmin = Boolean(viewer?.roles?.includes("admin"))

  const post = await db.post.findUnique({
    where: { id },
    include: {
      ...postArgs.include,
      comments: {
        where: isAdmin ? undefined : { status: "approved" },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!post) return null
  if (!isAdmin && (post.status !== "approved" || post.visibility !== "public")) return null

  return {
    ...mapPost(post),
    comments: post.comments.map(mapComment),
  }
}

export async function createCommunityPost(
  userId: string,
  input: {
    title: string
    content: string
    kind: CommunityPostKind
    groupId?: string | null
  },
) {
  return db.$transaction(async (tx) => {
    if (input.groupId) {
      const membership = await tx.studyGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId,
          },
        },
        include: {
          group: true,
        },
      })

      if (!membership || membership.status !== "active" || membership.group.status !== "active") {
        throw new CommunityError("group_membership_required", "加入学习小组后才能在组内发帖", 403)
      }
    }

    const post = await tx.post.create({
      data: {
        userId,
        groupId: input.groupId ?? null,
        kind: input.kind,
        visibility: "public",
        title: input.title,
        content: input.content,
        status: "approved",
      },
    })

    await awardPointsInTx(tx, userId, {
      actionType: "community_post_create",
      actionKey: `community_post_create:${post.id}`,
      pointsDelta: getPostPoints(input.kind),
      relatedType: "post",
      relatedId: post.id,
      note: `发布${input.groupId ? "小组" : "社区"}${input.kind === "achievement" ? "成就分享" : "动态"}`,
    })

    return post
  })
}

export async function createCommunityComment(userId: string, postId: string, content: string) {
  return db.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        groupId: true,
      },
    })

    if (!post || post.status !== "approved") {
      throw new CommunityError("post_not_found", "讨论不存在", 404)
    }

    if (post.groupId) {
      const membership = await tx.studyGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: post.groupId,
            userId,
          },
        },
      })

      if (!membership || membership.status !== "active") {
        throw new CommunityError("group_membership_required", "加入学习小组后才能参与组内讨论", 403)
      }
    }

    const comment = await tx.comment.create({
      data: {
        postId,
        userId,
        content,
        status: "approved",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await awardPointsInTx(tx, userId, {
      actionType: "community_comment_create",
      actionKey: `community_comment_create:${comment.id}`,
      pointsDelta: 5,
      relatedType: "comment",
      relatedId: comment.id,
      note: "参与讨论回复",
    })

    return mapComment(comment)
  })
}
