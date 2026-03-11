import type { ContentAccessResult } from "@/lib/content-access"

export type ProblemSolutionSummaryItem = {
  id: string
  title: string
  type: string
  visibility: string
  accessLevel: string | null
  isPremium: boolean
  summary: string | null
  previewContent: string | null
  hasVideo: boolean
  locked: boolean
  access: ContentAccessResult
  createdAt: string
  author: {
    id: string
    name: string | null
  }
  version: {
    id: string
    version: number
  } | null
}

export type SolutionDetailItem = ProblemSolutionSummaryItem & {
  content: string | null
  videoUrl: string | null
}

export type ProblemSolutionsResponse = {
  data: ProblemSolutionSummaryItem[]
}

export type SolutionDetailResponse = {
  data: SolutionDetailItem
}
