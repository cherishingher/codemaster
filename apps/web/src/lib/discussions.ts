export type DiscussionPostType =
  | "problem_discussion"
  | "solution"
  | "contest_discussion"
  | "question"
  | "experience"
  | "feedback"
  | "announcement"
  | "general"

export type DiscussionPostSort = "newest" | "hot" | "featured" | "unsolved"

export type DiscussionTargetType = "post" | "comment"

export type DiscussionQuestionHelpMode = "hint" | "bug_fix" | "complexity" | "concept"

export type DiscussionReportReasonCode =
  | "spoiler"
  | "advertisement"
  | "abuse"
  | "plagiarism"
  | "flood"
  | "illegal_content"
  | "other"

export type DiscussionReportStatus = "pending" | "processing" | "accepted" | "rejected" | "closed"

export type DiscussionPostTag = {
  id: string
  tagName: string
  tagSlug: string
  tagType: string
}

export type DiscussionAuthor = {
  id: string
  name: string | null
}

export type DiscussionPost = {
  id: string
  postType: DiscussionPostType
  title: string
  excerpt: string | null
  contentMarkdown: string
  problemId: string | null
  contestId: string | null
  auditStatus: string
  displayStatus: string
  publishStatus: string
  publishAt: string | null
  isLocked: boolean
  isPinned: boolean
  isFeatured: boolean
  isRecommended: boolean
  isSolved: boolean
  bestCommentId: string | null
  commentCount: number
  replyCount: number
  likeCount: number
  favoriteCount: number
  viewCount: number
  reportCount: number
  hotScore: number
  lastCommentAt: string | null
  author: DiscussionAuthor
  tags: DiscussionPostTag[]
  viewerState?: {
    liked: boolean
    favorited: boolean
  }
  createdAt: string
  updatedAt: string
}

export type DiscussionComment = {
  id: string
  postId: string
  authorId: string
  rootCommentId: string | null
  parentCommentId: string | null
  replyToUserId: string | null
  contentMarkdown: string
  depth: number
  floorNo: number
  likeCount: number
  replyCount: number
  author: DiscussionAuthor
  viewerLiked?: boolean
  createdAt: string
  updatedAt: string
  replies?: DiscussionComment[]
}

export type DiscussionModerationPost = DiscussionPost & {
  isDeleted: boolean
  problem: { id: string; title: string; slug: string | null } | null
  contest: { id: string; name: string } | null
}

export type DiscussionModerationComment = DiscussionComment & {
  auditStatus: string
  displayStatus: string
  isDeleted: boolean
  contentPreview: string | null
  post: {
    id: string
    title: string
    postType: DiscussionPostType
    problemId: string | null
    contestId: string | null
  }
}

export type DiscussionModerationReport = {
  id: string
  reporter: DiscussionAuthor | null
  targetType: DiscussionTargetType
  targetId: string
  reasonCode: DiscussionReportReasonCode
  reasonText: string | null
  status: DiscussionReportStatus
  handledById: string | null
  handledAt: string | null
  resultNote: string | null
  targetPreview: {
    title: string
    excerpt: string | null
    auditStatus: string
    displayStatus: string
    postId?: string
  } | null
  createdAt: string
  updatedAt: string
}

export type ApiListMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ApiDataResponse<T> = {
  data: T
}

export type ApiListResponse<T> = {
  data: T[]
  meta: ApiListMeta
}

export type DiscussionPostListResponse = ApiListResponse<DiscussionPost>
export type DiscussionPostDetailResponse = ApiDataResponse<DiscussionPost>
export type DiscussionCommentListResponse = ApiListResponse<DiscussionComment>
export type DiscussionCommentDetailResponse = ApiDataResponse<DiscussionComment>
export type DiscussionModerationPostListResponse = ApiListResponse<DiscussionModerationPost>
export type DiscussionModerationCommentListResponse = ApiListResponse<DiscussionModerationComment>
export type DiscussionModerationReportListResponse = ApiListResponse<DiscussionModerationReport>

export type DiscussionMutationResponse = ApiDataResponse<{
  success?: boolean
  liked?: boolean
  favorited?: boolean
  likeCount?: number
  favoriteCount?: number
}>

export const DISCUSSION_POST_TYPE_OPTIONS: Array<{
  value: DiscussionPostType
  label: string
  description: string
}> = [
  { value: "question", label: "算法问答", description: "提问、求助、卡点分析" },
  { value: "problem_discussion", label: "题目讨论", description: "围绕单题交流思路与疑问" },
  { value: "solution", label: "题解帖", description: "整理完整做法与代码思路" },
  { value: "contest_discussion", label: "比赛讨论", description: "赛前赛后交流与复盘" },
  { value: "experience", label: "经验分享", description: "学习方法、刷题规划、复盘总结" },
  { value: "feedback", label: "站务反馈", description: "反馈平台问题或产品建议" },
  { value: "general", label: "普通讨论", description: "非特定题目/比赛的一般话题" },
]

export const DISCUSSION_SORT_OPTIONS: Array<{ value: DiscussionPostSort; label: string }> = [
  { value: "featured", label: "精选优先" },
  { value: "hot", label: "热门" },
  { value: "newest", label: "最新" },
  { value: "unsolved", label: "待解决" },
]

export const DISCUSSION_REPORT_REASON_OPTIONS: Array<{
  value: DiscussionReportReasonCode
  label: string
}> = [
  { value: "spoiler", label: "剧透或泄题" },
  { value: "advertisement", label: "广告引流" },
  { value: "abuse", label: "辱骂攻击" },
  { value: "plagiarism", label: "抄袭搬运" },
  { value: "flood", label: "灌水刷屏" },
  { value: "illegal_content", label: "违规内容" },
  { value: "other", label: "其他" },
]

export const DISCUSSION_QUESTION_HELP_MODE_OPTIONS: Array<{
  value: DiscussionQuestionHelpMode
  label: string
  description: string
}> = [
  { value: "hint", label: "思路提醒", description: "只想确认方向、状态设计或关键转化" },
  { value: "bug_fix", label: "查错定位", description: "代码或思路大体对，但边界、判定或细节有误" },
  { value: "complexity", label: "复杂度优化", description: "当前做法能过样例，但复杂度可能不够" },
  { value: "concept", label: "概念理解", description: "不理解算法、性质或题意里的某个点" },
]

export function getDiscussionPostTypeLabel(type: DiscussionPostType) {
  const match = DISCUSSION_POST_TYPE_OPTIONS.find((item) => item.value === type)
  return match?.label ?? type
}

export function getDiscussionSortLabel(sort: DiscussionPostSort) {
  const match = DISCUSSION_SORT_OPTIONS.find((item) => item.value === sort)
  return match?.label ?? sort
}

export function getDiscussionReportReasonLabel(reasonCode: DiscussionReportReasonCode) {
  const match = DISCUSSION_REPORT_REASON_OPTIONS.find((item) => item.value === reasonCode)
  return match?.label ?? reasonCode
}

export function getDiscussionTitlePlaceholder(type: DiscussionPostType) {
  switch (type) {
    case "question":
      return "例如：这题为什么单调栈在重复元素时会多弹一次？"
    case "problem_discussion":
      return "例如：这题样例二为什么不能直接贪心？"
    case "solution":
      return "例如：P1001 题解：单调队列 + 二分答案"
    case "contest_discussion":
      return "例如：NOIP 模拟赛 Round 3 赛后复盘"
    case "experience":
      return "例如：从入门到提高的刷题节奏怎么安排？"
    case "feedback":
      return "例如：题目页评论入口在移动端被遮挡"
    case "announcement":
      return "例如：讨论区发布规范更新"
    default:
      return "输入讨论标题"
  }
}

export function getDiscussionComposerHint(type: DiscussionPostType) {
  switch (type) {
    case "question":
      return "问答帖建议按模板写清已尝试内容和具体卡点，默认优先求思路、边界和错因，不直接索要整份 AC 代码。"
    case "problem_discussion":
      return "题目讨论必须绑定题目，适合交流题意理解、边界情况、样例歧义和常见误区。"
    case "solution":
      return "题解帖必须绑定题目。若题目处于进行中的比赛，后端会自动延迟公开，避免剧透。"
    case "contest_discussion":
      return "比赛讨论必须绑定比赛。比赛进行中禁止贴代码、正解和关键结论，普通用户发布会更严格审核。"
    case "experience":
      return "经验帖适合沉淀训练路径、错题复盘、学习方法和阶段性总结。"
    case "feedback":
      return "站务反馈请尽量写清复现路径、期望行为和影响范围。"
    case "announcement":
      return "公告帖仅管理员可发布。"
    default:
      return "讨论区优先服务算法学习、做题交流、比赛复盘和题解沉淀。"
  }
}

export function getDiscussionBodyPlaceholder(type: DiscussionPostType) {
  switch (type) {
    case "problem_discussion":
      return "围绕题意理解、样例、边界、判题规则或错误思路展开。尽量先给自己的分析，再提疑问。"
    case "solution":
      return "建议按“核心思路 / 正确性 / 复杂度 / 关键代码片段”来组织题解。"
    case "contest_discussion":
      return "可以写赛前准备、赛后复盘、心态总结和比赛体验。比赛进行中请不要贴解法和代码。"
    case "experience":
      return "分享训练计划、错题总结、阶段复盘或学习建议。"
    case "feedback":
      return "说明问题现象、复现步骤、期望行为和设备环境。"
    case "announcement":
      return "写明规则、时间点、影响范围或公告详情。"
    default:
      return "支持 Markdown。"
  }
}

export function getDiscussionCommentPlaceholder(type: DiscussionPostType) {
  switch (type) {
    case "question":
      return "优先指出思路、边界、错因或复杂度问题，尽量不要直接贴整份 AC 代码。"
    case "problem_discussion":
      return "补充你对题意、边界或样例的理解，也可以指出容易踩坑的地方。"
    case "solution":
      return "可以讨论正确性、复杂度、代码实现细节或更优写法。"
    case "contest_discussion":
      return "赛中避免剧透，赛后可以复盘策略、卡点和时间分配。"
    default:
      return "支持 Markdown，写下你的补充、疑问或建议。"
  }
}

export function getDiscussionContextBinding(type: DiscussionPostType) {
  return {
    requiresProblem: type === "problem_discussion" || type === "solution",
    requiresContest: type === "contest_discussion",
  }
}

export function buildStructuredQuestionMarkdown(input: {
  helpMode: DiscussionQuestionHelpMode
  attemptSummary: string
  stuckPoint: string
  errorMessage?: string
  extraContext?: string
}) {
  const helpModeLabel =
    DISCUSSION_QUESTION_HELP_MODE_OPTIONS.find((item) => item.value === input.helpMode)?.label ?? input.helpMode

  const sections = [
    `## 求助类型\n${helpModeLabel}`,
    `## 我已经尝试过\n${input.attemptSummary.trim()}`,
    `## 当前卡点\n${input.stuckPoint.trim()}`,
  ]

  if (input.errorMessage?.trim()) {
    sections.push(`## 报错或异常现象\n${input.errorMessage.trim()}`)
  }

  if (input.extraContext?.trim()) {
    sections.push(`## 补充信息\n${input.extraContext.trim()}`)
  }

  sections.push("## 求助边界\n请优先指出思路、边界条件或错误原因；如果需要给代码，请只给关键片段，不直接贴整份 AC 代码。")

  return sections.join("\n\n")
}

export function getDiscussionPostTypeTone(type: DiscussionPostType) {
  switch (type) {
    case "question":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700"
    case "problem_discussion":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700"
    case "solution":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    case "contest_discussion":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700"
    case "experience":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700"
    case "feedback":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700"
    case "announcement":
      return "border-slate-500/30 bg-slate-500/10 text-slate-700"
    default:
      return "border-primary/30 bg-primary/10 text-primary"
  }
}

export function formatDiscussionDateTime(value: string | null | undefined) {
  if (!value) return "未知时间"
  return new Date(value).toLocaleString("zh-CN")
}
