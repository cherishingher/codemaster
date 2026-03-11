import type { ContentAccessProductRecommendation } from "@/lib/content-access"

export type CmsStatus = "draft" | "review" | "published"
export type CmsResourceType = "solution" | "video" | "training_path"

export type SolutionTemplateType =
  | "official_standard"
  | "bruteforce_to_optimized"
  | "dp_five_step"

export type SolutionTemplateOption = {
  type: SolutionTemplateType
  label: string
  content: string
}

export const SOLUTION_TEMPLATE_OPTIONS: SolutionTemplateOption[] = [
  {
    type: "official_standard",
    label: "官方题解模板",
    content: [
      "## 题意概括",
      "",
      "用 2-3 句话概括题目目标、输入输出和关键限制。",
      "",
      "## 解题思路",
      "",
      "先说明核心观察，再拆成具体步骤。",
      "",
      "## 正确性说明",
      "",
      "解释为什么状态设计或贪心/枚举策略是成立的。",
      "",
      "## 复杂度分析",
      "",
      "- 时间复杂度：",
      "- 空间复杂度：",
      "",
      "## 易错点",
      "",
      "- ",
    ].join("\n"),
  },
  {
    type: "bruteforce_to_optimized",
    label: "暴力到优化模板",
    content: [
      "## 暴力思路",
      "",
      "先给出最直接的枚举或模拟方法，并说明瓶颈。",
      "",
      "## 优化关键",
      "",
      "指出从暴力到优化的核心转折点，例如前缀和、哈希、排序、单调性等。",
      "",
      "## 最终做法",
      "",
      "给出最终算法流程。",
      "",
      "## 复杂度分析",
      "",
      "- 时间复杂度：",
      "- 空间复杂度：",
    ].join("\n"),
  },
  {
    type: "dp_five_step",
    label: "DP 五步模板",
    content: [
      "## 1. 状态定义",
      "",
      "明确 `dp[i]` / `dp[i][j]` 的含义。",
      "",
      "## 2. 状态转移",
      "",
      "列出完整转移式，并解释来源。",
      "",
      "## 3. 初始化",
      "",
      "说明边界条件。",
      "",
      "## 4. 遍历顺序",
      "",
      "解释为什么要这样枚举。",
      "",
      "## 5. 答案提取",
      "",
      "说明最后从哪个状态得到答案。",
      "",
      "## 复杂度分析",
      "",
      "- 时间复杂度：",
      "- 空间复杂度：",
    ].join("\n"),
  },
]

export type CmsWorkflowLogItem = {
  id: string
  resourceType: CmsResourceType
  resourceId: string
  fromStatus?: string | null
  toStatus: string
  action: string
  note?: string | null
  operator: {
    id: string
    name: string | null
    email: string | null
  }
  createdAt: string
}

export type CmsAssetItem = {
  id: string
  assetType: string
  title: string
  description?: string | null
  status: string
  sourceUrl: string
  mimeType?: string | null
  durationSec?: number | null
  thumbnailUrl?: string | null
  resourceType?: string | null
  resourceId?: string | null
  createdAt: string
  updatedAt: string
}

export type CmsSolutionDetail = {
  id: string
  title: string
  summary?: string | null
  content: string
  templateType?: string | null
  type: string
  visibility: string
  accessLevel?: string | null
  isPremium: boolean
  videoUrl?: string | null
  status: string
  problem: {
    id: string
    slug: string
    title: string
    difficulty: number
    tags: string[]
  }
  linkedProducts: ContentAccessProductRecommendation[]
  suggestedProducts: ContentAccessProductRecommendation[]
  workflowLogs: CmsWorkflowLogItem[]
}

export type CmsVideoListItem = {
  lessonId: string
  title: string
  summary?: string | null
  type: string
  status: string
  isPreview: boolean
  courseTitle: string
  sectionTitle: string
  assetUri?: string | null
  assets: CmsAssetItem[]
}

export type CmsPathListItem = {
  id: string
  slug?: string | null
  title: string
  summary?: string | null
  description?: string | null
  kind: string
  visibility: string
  status: string
  itemCount: number
  updatedAt: string
}

export type CmsPathDetail = CmsPathListItem & {
  items: Array<{
    orderIndex: number
    problem: {
      id: string
      slug: string
      title: string
      difficulty: number
      tags: string[]
    }
  }>
  workflowLogs: CmsWorkflowLogItem[]
  linkedProducts: ContentAccessProductRecommendation[]
  suggestedProducts: ContentAccessProductRecommendation[]
}

export type CmsOverviewResponse = {
  data: {
    counts: Record<CmsResourceType, Record<CmsStatus, number>>
    recentLogs: CmsWorkflowLogItem[]
  }
}

export type CmsSolutionDetailResponse = { data: CmsSolutionDetail }
export type CmsVideoListResponse = { data: CmsVideoListItem[] }
export type CmsAssetListResponse = { data: CmsAssetItem[] }
export type CmsPathListResponse = { data: CmsPathListItem[] }
export type CmsPathDetailResponse = { data: CmsPathDetail }
export type CmsWorkflowLogListResponse = { data: CmsWorkflowLogItem[] }

export type CmsStatusTransitionInput = {
  resourceType: CmsResourceType
  resourceId: string
  toStatus: CmsStatus
  note?: string
}

export type CmsSolutionUpdateInput = {
  title?: string
  summary?: string
  content?: string
  templateType?: string
  visibility?: string
  accessLevel?: string
  isPremium?: boolean
  videoUrl?: string
}

export type CmsAssetCreateInput = {
  assetType: string
  title: string
  description?: string
  sourceUrl: string
  mimeType?: string
  durationSec?: number | null
  thumbnailUrl?: string
  resourceType?: string
  resourceId?: string
}

export type CmsVideoUpdateInput = {
  title?: string
  summary?: string
  type?: string
  assetUri?: string
  isPreview?: boolean
  status?: CmsStatus
}

export type CmsPathUpdateInput = {
  title?: string
  slug?: string
  summary?: string
  description?: string
  visibility?: string
  status?: CmsStatus
  kind?: string
}

export type CmsPathBulkItemsInput = {
  items: Array<{
    problemId: string
    orderIndex: number
  }>
}
