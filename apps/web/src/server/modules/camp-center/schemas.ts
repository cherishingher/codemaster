import { z } from "zod"

export const CampListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
})

export const CampIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export const CampClassIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export const CampScopedClassQuerySchema = z.object({
  classId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const CampCheckinSchema = z.object({
  classId: z.string().trim().min(1).max(64),
  taskId: z.string().trim().min(1).max(64),
  note: z.string().trim().max(500).optional(),
})

export type CampListQuery = z.infer<typeof CampListQuerySchema>
export type CampScopedClassQuery = z.infer<typeof CampScopedClassQuerySchema>
export type CampCheckinInput = z.infer<typeof CampCheckinSchema>
