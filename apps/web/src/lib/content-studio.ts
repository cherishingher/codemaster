import type { ContentAccessProductRecommendation } from "@/lib/content-access"

export type ContentStudioResourceType = "solution" | "video" | "training_path"

export type ContentStudioBaseItem = {
  resourceType: ContentStudioResourceType
  id: string
  title: string
  summary?: string | null
  visibility: string
  accessLevel?: string | null
  linkedProducts: ContentAccessProductRecommendation[]
  suggestedProducts: ContentAccessProductRecommendation[]
}

export type ContentStudioSolutionItem = ContentStudioBaseItem & {
  resourceType: "solution"
  problemId: string
  problemSlug: string
  problemTitle: string
  hasVideo: boolean
  videoUrl?: string | null
  isPremium: boolean
  createdAt: string
}

export type ContentStudioVideoItem = ContentStudioBaseItem & {
  resourceType: "video"
  courseId: string
  courseTitle: string
  sectionId: string
  sectionTitle: string
  type: string
  isPreview: boolean
  assetUri?: string | null
}

export type ContentStudioTrainingPathItem = ContentStudioBaseItem & {
  resourceType: "training_path"
  slug: string
  chapterCount: number
  difficultyBand: string
  topTags: string[]
  previewChapters: Array<{
    id: string
    title: string
    problemCount: number
  }>
}

export type ContentStudioOverviewPayload = {
  solutions: ContentStudioSolutionItem[]
  videos: ContentStudioVideoItem[]
  trainingPaths: ContentStudioTrainingPathItem[]
}

export type ContentStudioOverviewResponse = {
  data: ContentStudioOverviewPayload
}

export type ContentStudioSolutionUpdateInput = {
  summary?: string
  visibility?: string
  accessLevel?: string
  isPremium?: boolean
  videoUrl?: string
}

export type ContentStudioVideoUpdateInput = {
  title?: string
  summary?: string
  type?: string
  thumbnailUrl?: string
  assetUri?: string
  isPreview?: boolean
}
