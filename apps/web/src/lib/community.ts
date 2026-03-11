export type CommunityPostKind = "discussion" | "activity" | "achievement" | "question"

export type StudyGroupMemberView = {
  id: string
  userId: string
  name: string | null
  role: string
  joinedAt: string
}

export type StudyGroupListItem = {
  id: string
  slug: string
  name: string
  summary: string | null
  topic: string | null
  level: string
  visibility: string
  status: string
  memberLimit: number | null
  memberCount: number
  postCount: number
  owner: {
    id: string
    name: string | null
  }
  joined: boolean
  role: string | null
  createdAt: string
}

export type StudyGroupDetailItem = StudyGroupListItem & {
  description: string | null
  members: StudyGroupMemberView[]
}

export type CommunityPostItem = {
  id: string
  kind: CommunityPostKind
  groupId: string | null
  title: string
  content: string
  status: string
  visibility: string
  author: {
    id: string
    name: string | null
  }
  group: {
    id: string
    slug: string
    name: string
  } | null
  commentCount: number
  createdAt: string
  updatedAt: string
}

export type CommunityCommentItem = {
  id: string
  content: string
  author: {
    id: string
    name: string | null
  }
  createdAt: string
}

export type CommunityPostDetailItem = CommunityPostItem & {
  comments: CommunityCommentItem[]
}

export type PointsSummary = {
  balance: number
  recentTransactions: Array<{
    id: string
    actionType: string
    pointsDelta: number
    balanceAfter: number
    note: string | null
    createdAt: string
  }>
  recentRedemptions: Array<{
    id: string
    productId: string
    productName: string
    pointsCost: number
    status: string
    createdAt: string
  }>
}

export type CommunityRewardItem = {
  productId: string
  name: string
  summary: string | null
  coverImage: string | null
  type: string
  pointsCost: number
  redeemable: boolean
  currentBalance: number
  defaultSkuPriceText: string
}

export type StudyGroupListResponse = {
  data: StudyGroupListItem[]
}

export type StudyGroupDetailResponse = {
  data: StudyGroupDetailItem
}

export type CommunityFeedResponse = {
  data: CommunityPostItem[]
}

export type CommunityPostDetailResponse = {
  data: CommunityPostDetailItem
}

export type CommunityPointsResponse = {
  data: PointsSummary
}

export type CommunityRewardsResponse = {
  data: CommunityRewardItem[]
}

export type CommunityMutationResponse = {
  data: {
    id: string
    status?: string
    pointsBalance?: number
  }
}

export function getCommunityPostKindLabel(kind: CommunityPostKind) {
  switch (kind) {
    case "activity":
      return "学习动态"
    case "achievement":
      return "成就分享"
    case "question":
      return "提问答疑"
    default:
      return "讨论"
  }
}

export function getCommunityLevelLabel(level: string) {
  switch (level) {
    case "beginner":
      return "入门"
    case "intermediate":
      return "进阶"
    case "advanced":
      return "高级"
    default:
      return "混合"
  }
}
