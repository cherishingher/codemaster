import { z } from "zod"

export const CommunityGroupsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
})

export const CreateStudyGroupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  topic: z.string().trim().max(80).optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "mixed"]).optional(),
  memberLimit: z.number().int().min(2).max(500).nullable().optional(),
})

export const CommunityFeedQuerySchema = z.object({
  groupId: z.string().trim().max(64).optional(),
  kind: z.enum(["discussion", "activity", "achievement", "question"]).optional(),
})

export const CreateCommunityPostSchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(2).max(10000),
  kind: z.enum(["discussion", "activity", "achievement", "question"]).default("discussion"),
  groupId: z.string().trim().max(64).optional(),
})

export const CreateCommunityCommentSchema = z.object({
  content: z.string().trim().min(1).max(3000),
})
