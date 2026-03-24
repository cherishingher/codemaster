import { z } from "zod"
import {
  DiscussionAuditStatus,
  DiscussionDisplayStatus,
  DiscussionModerationActionType,
  DiscussionPostType,
  DiscussionReportReasonCode,
  DiscussionReportStatus,
  DiscussionTargetType,
} from "@prisma/client"

export const DiscussionPostListQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  postType: z.nativeEnum(DiscussionPostType).optional(),
  problemId: z.string().trim().max(64).optional(),
  contestId: z.string().trim().max(64).optional(),
  tagId: z.string().trim().max(64).optional(),
  authorId: z.string().trim().max(64).optional(),
  sort: z.enum(["newest", "hot", "featured", "unsolved"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const CreateDiscussionPostSchema = z.object({
  postType: z.nativeEnum(DiscussionPostType),
  title: z.string().trim().min(2).max(160),
  contentMarkdown: z.string().trim().min(2).max(50000),
  problemId: z.string().trim().max(64).optional(),
  contestId: z.string().trim().max(64).optional(),
  tagIds: z.array(z.string().trim().max(64)).max(5).optional(),
})

export const UpdateDiscussionPostSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  contentMarkdown: z.string().trim().min(2).max(50000).optional(),
  tagIds: z.array(z.string().trim().max(64)).max(5).optional(),
})

export const DiscussionPostCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const CreateDiscussionCommentSchema = z.object({
  contentMarkdown: z.string().trim().min(1).max(10000),
  parentCommentId: z.string().trim().max(64).optional(),
  replyToUserId: z.string().trim().max(64).optional(),
})

export const UpdateDiscussionCommentSchema = z.object({
  contentMarkdown: z.string().trim().min(1).max(10000),
})

export const CreateDiscussionReportSchema = z.object({
  targetType: z.nativeEnum(DiscussionTargetType),
  targetId: z.string().trim().max(64),
  reasonCode: z.nativeEnum(DiscussionReportReasonCode),
  reasonText: z.string().trim().max(500).optional(),
})

export const AuditDiscussionTargetSchema = z.object({
  auditStatus: z.nativeEnum(DiscussionAuditStatus),
  reason: z.string().trim().max(500).optional(),
})

export const ModerateDiscussionTargetSchema = z.object({
  actionType: z.nativeEnum(DiscussionModerationActionType),
  reason: z.string().trim().max(500).optional(),
})

export const SetDiscussionBestCommentSchema = z.object({
  commentId: z.string().trim().max(64),
})

export const MarkDiscussionSolvedSchema = z.object({
  isSolved: z.boolean(),
})

export const DiscussionModerationPostsQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  postType: z.nativeEnum(DiscussionPostType).optional(),
  auditStatus: z.nativeEnum(DiscussionAuditStatus).optional(),
  displayStatus: z.nativeEnum(DiscussionDisplayStatus).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const DiscussionModerationCommentsQuerySchema = z.object({
  keyword: z.string().trim().max(100).optional(),
  auditStatus: z.nativeEnum(DiscussionAuditStatus).optional(),
  displayStatus: z.nativeEnum(DiscussionDisplayStatus).optional(),
  postId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const DiscussionModerationReportsQuerySchema = z.object({
  status: z.nativeEnum(DiscussionReportStatus).optional(),
  targetType: z.nativeEnum(DiscussionTargetType).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export const ResolveDiscussionReportSchema = z.object({
  status: z.nativeEnum(DiscussionReportStatus),
  resultNote: z.string().trim().max(500).optional(),
})
