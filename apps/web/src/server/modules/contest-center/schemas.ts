import { z } from "zod"

export const ContestListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
})

export const ContestIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export const ContestRankingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ContestListQuery = z.infer<typeof ContestListQuerySchema>
export type ContestRankingQuery = z.infer<typeof ContestRankingQuerySchema>
