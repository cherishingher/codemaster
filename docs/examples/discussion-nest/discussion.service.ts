import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { CreatePostDto, DiscussionPostType } from "./dto/create-post.dto"
import { QueryPostListDto, DiscussionSortType } from "./dto/query-post-list.dto"
import { UpdatePostDto } from "./dto/update-post.dto"

type CurrentUser = {
  id: string
  roles: string[]
}

type PrismaClientLike = {
  discussionPost: {
    create(args: Prisma.DiscussionPostCreateArgs): Promise<unknown>
    update(args: Prisma.DiscussionPostUpdateArgs): Promise<unknown>
    findUnique(args: Prisma.DiscussionPostFindUniqueArgs): Promise<any>
    findMany(args: Prisma.DiscussionPostFindManyArgs): Promise<any[]>
    count(args: Prisma.DiscussionPostCountArgs): Promise<number>
  }
  discussionComment: {
    create(args: Prisma.DiscussionCommentCreateArgs): Promise<unknown>
    findUnique(args: Prisma.DiscussionCommentFindUniqueArgs): Promise<any>
  }
}

@Injectable()
export class DiscussionService {
  constructor(
    private readonly prisma: PrismaClientLike,
  ) {}

  async createPost(user: CurrentUser, dto: CreatePostDto) {
    this.validatePostBinding(dto)

    return this.prisma.discussionPost.create({
      data: {
        authorId: user.id,
        postType: dto.postType,
        title: dto.title,
        contentMarkdown: dto.contentMarkdown,
        problemId: dto.problemId ?? null,
        contestId: dto.contestId ?? null,
        auditStatus: "pending",
        displayStatus: "visible",
        publishStatus: dto.postType === DiscussionPostType.SOLUTION ? "delayed_by_contest" : "immediate",
      },
    })
  }

  async updatePost(user: CurrentUser, postId: string, dto: UpdatePostDto) {
    const post = await this.prisma.discussionPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, isLocked: true, isDeleted: true },
    })

    if (!post || post.isDeleted) throw new NotFoundException("post_not_found")
    if (post.authorId !== user.id && !user.roles.includes("moderator") && !user.roles.includes("admin")) {
      throw new ForbiddenException("forbidden")
    }
    if (post.isLocked && post.authorId === user.id && !user.roles.includes("moderator") && !user.roles.includes("admin")) {
      throw new ForbiddenException("post_locked")
    }

    if (dto.postType) this.validatePostBinding(dto as CreatePostDto)

    return this.prisma.discussionPost.update({
      where: { id: postId },
      data: {
        title: dto.title,
        contentMarkdown: dto.contentMarkdown,
        problemId: dto.problemId,
        contestId: dto.contestId,
      },
    })
  }

  async getPostDetail(postId: string) {
    const post = await this.prisma.discussionPost.findUnique({
      where: { id: postId },
    })
    if (!post) throw new NotFoundException("post_not_found")
    return post
  }

  async listPosts(query: QueryPostListDto) {
    const where: Prisma.DiscussionPostWhereInput = {
      auditStatus: "approved",
      displayStatus: "visible",
      isDeleted: false,
      ...(query.postType ? { postType: query.postType } : {}),
      ...(query.problemId ? { problemId: query.problemId } : {}),
      ...(query.contestId ? { contestId: query.contestId } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword } },
              { excerpt: { contains: query.keyword } },
              { contentPlain: { contains: query.keyword } },
            ],
          }
        : {}),
    }

    const orderBy =
      query.sort === DiscussionSortType.HOT
        ? [{ hotScore: "desc" as const }, { createdAt: "desc" as const }]
        : query.sort === DiscussionSortType.FEATURED
        ? [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }]
        : query.sort === DiscussionSortType.UNSOLVED
        ? [{ isSolved: "asc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }]

    const [items, total] = await Promise.all([
      this.prisma.discussionPost.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.discussionPost.count({ where }),
    ])

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async createComment(user: CurrentUser, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.discussionPost.findUnique({
      where: { id: postId },
      select: { id: true, isLocked: true, isDeleted: true },
    })

    if (!post || post.isDeleted) throw new NotFoundException("post_not_found")
    if (post.isLocked) throw new ForbiddenException("post_locked")

    let rootCommentId: string | null = null
    let depth = 1

    if (dto.parentCommentId) {
      const parent = await this.prisma.discussionComment.findUnique({
        where: { id: dto.parentCommentId },
        select: { id: true, postId: true, depth: true, rootCommentId: true, authorId: true },
      })

      if (!parent || parent.postId !== postId) throw new NotFoundException("comment_not_found")
      if (parent.depth >= 2) throw new ForbiddenException("reply_depth_exceeded")

      depth = 2
      rootCommentId = parent.rootCommentId ?? parent.id
    }

    return this.prisma.discussionComment.create({
      data: {
        postId,
        authorId: user.id,
        parentCommentId: dto.parentCommentId ?? null,
        rootCommentId,
        depth,
        contentMarkdown: dto.contentMarkdown,
        auditStatus: "pending",
        displayStatus: "visible",
      },
    })
  }

  async auditPost(operator: CurrentUser, postId: string, auditStatus: "approved" | "rejected", reason?: string) {
    if (!operator.roles.includes("moderator") && !operator.roles.includes("admin")) {
      throw new ForbiddenException("forbidden")
    }

    const post = await this.prisma.discussionPost.findUnique({
      where: { id: postId },
      select: { id: true, auditStatus: true, metadata: true },
    })
    if (!post) throw new NotFoundException("post_not_found")

    return this.prisma.discussionPost.update({
      where: { id: postId },
      data: {
        auditStatus,
        metadata: {
          ...(typeof post.metadata === "object" && post.metadata ? post.metadata : {}),
          lastAuditReason: reason ?? null,
        },
      } as any,
    })
  }

  async setBestComment(user: CurrentUser, postId: string, commentId: string) {
    const [post, comment] = await Promise.all([
      this.prisma.discussionPost.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true, postType: true, isDeleted: true },
      }),
      this.prisma.discussionComment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, isDeleted: true },
      }),
    ])

    if (!post || post.isDeleted) throw new NotFoundException("post_not_found")
    if (!comment || comment.isDeleted || comment.postId !== postId) {
      throw new NotFoundException("comment_not_found")
    }
    if (post.postType !== DiscussionPostType.QUESTION) {
      throw new ForbiddenException("best_comment_invalid")
    }
    if (post.authorId !== user.id && !user.roles.includes("moderator") && !user.roles.includes("admin")) {
      throw new ForbiddenException("forbidden")
    }

    return this.prisma.discussionPost.update({
      where: { id: postId },
      data: {
        bestCommentId: commentId,
        isSolved: true,
        solvedAt: new Date(),
        acceptedById: user.id,
      },
    })
  }

  private validatePostBinding(dto: CreatePostDto) {
    if (
      [DiscussionPostType.PROBLEM_DISCUSSION, DiscussionPostType.SOLUTION].includes(dto.postType) &&
      !dto.problemId
    ) {
      throw new ForbiddenException("problem_id_required")
    }

    if (dto.postType === DiscussionPostType.CONTEST_DISCUSSION && !dto.contestId) {
      throw new ForbiddenException("contest_id_required")
    }
  }
}
