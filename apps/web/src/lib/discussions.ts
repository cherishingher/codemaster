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

export type DiscussionReportReasonCode =
  | "spoiler"
  | "advertisement"
  | "abuse"
  | "plagiarism"
  | "flood"
  | "illegal_content"
  | "other"

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

export function getDiscussionPostTypeLabel(type: DiscussionPostType) {
  const match = DISCUSSION_POST_TYPE_OPTIONS.find((item) => item.value === type)
  return match?.label ?? type
}

export function getDiscussionSortLabel(sort: DiscussionPostSort) {
  const match = DISCUSSION_SORT_OPTIONS.find((item) => item.value === sort)
  return match?.label ?? sort
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
