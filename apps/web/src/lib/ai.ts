export const AI_RECOMMENDATION_WINDOW_DAYS = 30
export const AI_PLAN_DEFAULT_DAYS = 7

export type AiRecommendationResourceType =
  | "training_path"
  | "problem"
  | "solution"
  | "video"

export type AiRecommendationSource =
  | "weak_tag"
  | "wrong_answer"
  | "active_path"
  | "interest"
  | "goal"

export type AiTagSignal = {
  tag: string
  attemptedProblems: number
  solvedProblems: number
  wrongSubmissions: number
  completionRate: number
}

export type AiUserProfileSummary = {
  activeDays: number
  attemptedProblems: number
  solvedProblems: number
  acceptedRate: number
  weakTags: AiTagSignal[]
  strongTags: AiTagSignal[]
  interests: string[]
  activePathTitles: string[]
}

export type AiRecommendationItem = {
  id: string
  resourceType: AiRecommendationResourceType
  title: string
  summary: string
  href: string
  reason: string
  source: AiRecommendationSource
  tags: string[]
  difficulty: number | null
  locked: boolean
  requiredSources: string[]
}

export type AiRecommendationsPayload = {
  generatedAt: string
  profile: AiUserProfileSummary
  items: AiRecommendationItem[]
}

export type AiPlanTask = {
  id: string
  title: string
  description: string
  estimatedMinutes: number
  resourceType: AiRecommendationResourceType | "review" | "reflection"
  href: string | null
  locked: boolean
  requiredSources: string[]
}

export type AiPlanDay = {
  day: number
  focus: string
  estimatedMinutes: number
  tasks: AiPlanTask[]
}

export type AiLearningPlanPayload = {
  generatedAt: string
  goal: string
  windowDays: number
  summary: string
  focusTags: string[]
  focusPaths: string[]
  adjustments: string[]
  profile: AiUserProfileSummary
  plan: AiPlanDay[]
}

export type AiTutorPayload = {
  generatedAt: string
  mode: "heuristic" | "llm"
  question: string
  answer: string
  followUps: string[]
  profile: AiUserProfileSummary
  relatedResources: AiRecommendationItem[]
  context: {
    problemId: string | null
    problemTitle: string | null
  }
}

export type AiRecommendationsResponse = {
  data: AiRecommendationsPayload
}

export type AiLearningPlanResponse = {
  data: AiLearningPlanPayload
}

export type AiTutorResponse = {
  data: AiTutorPayload
}

export function formatAiRate(value: number) {
  return `${Math.round(value * 100)}%`
}

