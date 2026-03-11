import { z } from "zod"

export const TrainingPathListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
})

export const TrainingPathIdParamSchema = z.object({
  id: z.string().trim().min(1).max(160),
})
