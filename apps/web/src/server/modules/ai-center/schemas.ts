import { z } from "zod"
import { AI_PLAN_DEFAULT_DAYS } from "@/lib/ai"

export const AiRecommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
  goal: z.string().trim().max(120).optional(),
})

export const AiLearningPlanSchema = z.object({
  goal: z.string().trim().min(2).max(120).default("提升最近一周的训练效率并继续当前路径"),
  days: z.coerce.number().int().min(3).max(14).default(AI_PLAN_DEFAULT_DAYS),
})

export const AiTutorSchema = z.object({
  question: z.string().trim().min(2).max(1200),
  problemId: z.string().trim().max(64).optional(),
})

export type AiRecommendationsQuery = z.infer<typeof AiRecommendationsQuerySchema>
export type AiLearningPlanInput = z.infer<typeof AiLearningPlanSchema>
export type AiTutorInput = z.infer<typeof AiTutorSchema>

