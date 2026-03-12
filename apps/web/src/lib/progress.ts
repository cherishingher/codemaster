export type ProgressRow = {
  problem: {
    id: string
    slug: string
    title: string
    difficulty: number
    source?: string | null
  }
  status: number
  attempts: number
  bestScore: number
  lastStatus?: string | null
  solvedAt?: string | null
  lastSubmissionId?: string | null
  updatedAt: string
}

export type ProgressListResponse = {
  data: ProgressRow[]
  meta: {
    total: number
    limit: number
  }
  items?: ProgressRow[]
}
