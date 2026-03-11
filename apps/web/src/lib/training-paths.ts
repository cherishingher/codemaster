import type { ContentAccessResult } from "@/lib/content-access"

export type TrainingPathVisibility =
  | "public"
  | "membership"
  | "purchase"
  | "membership_or_purchase"

export type TrainingPathLevel = "beginner" | "intermediate" | "advanced"

export type TrainingPathDifficultyBand =
  | "intro"
  | "search"
  | "dynamic_programming"
  | "graph"
  | "advanced_algorithms"
  | "interview"

export type TrainingPathOwner = {
  id: string
  name: string | null
}

export type TrainingPathProblemStatus = "not_started" | "attempted" | "solved"

export type TrainingPathDifficultySummary = {
  easy: number
  medium: number
  hard: number
  average: number | null
}

export type TrainingPathRecentPosition = {
  chapterId: string
  chapterTitle: string
  problemId: string
  problemSlug: string
  problemTitle: string
  updatedAt: string
} | null

export type TrainingPathProgressSummary = {
  totalProblems: number
  completedProblems: number
  attemptedProblems: number
  completionRate: number
  currentChapterId: string | null
  currentProblemId: string | null
  lastLearningPosition: TrainingPathRecentPosition
}

export type TrainingPathProblemItem = {
  orderIndex: number
  problem: {
    id: string
    slug: string
    title: string
    difficulty: number | null
    source: string | null
    tags: string[]
  }
}

export type TrainingPathChapterProgressItem = {
  problemId: string
  status: TrainingPathProblemStatus
  attempts: number
  bestScore: number
  updatedAt: string | null
  solvedAt: string | null
}

export type TrainingPathChapterItem = {
  id: string
  title: string
  summary: string
  sortOrder: number
  problemCount: number
  difficultySummary: TrainingPathDifficultySummary
  problems: TrainingPathProblemItem[]
}

export type TrainingPathChapterProgress = {
  id: string
  title: string
  totalProblems: number
  completedProblems: number
  attemptedProblems: number
  completionRate: number
  currentProblemId: string | null
  problems: TrainingPathChapterProgressItem[]
}

export type TrainingPathListItem = {
  id: string
  slug: string
  title: string
  summary: string
  description: string
  visibility: TrainingPathVisibility
  level: TrainingPathLevel
  difficultyBand: TrainingPathDifficultyBand
  createdAt: string
  owner: TrainingPathOwner
  chapterCount: number
  itemCount: number
  topTags: string[]
  difficultySummary: TrainingPathDifficultySummary
  previewChapters: Array<{
    id: string
    title: string
    problemCount: number
  }>
  locked: boolean
  access: ContentAccessResult
  progress: TrainingPathProgressSummary | null
}

export type TrainingPathDetailItem = TrainingPathListItem & {
  chapters: TrainingPathChapterItem[]
}

export type TrainingPathProgressPayload = {
  pathId: string
  locked: boolean
  access: ContentAccessResult
  summary: TrainingPathProgressSummary | null
  chapters: TrainingPathChapterProgress[]
}

export type TrainingPathListResponse = {
  data: TrainingPathListItem[]
  meta: {
    total: number
    q: string
  }
}

export type TrainingPathDetailResponse = {
  data: TrainingPathDetailItem
}

export type TrainingPathProgressResponse = {
  data: TrainingPathProgressPayload
}

export type TrainingPathChapterDefinition = {
  id: string
  title: string
  summary: string
  take: number
  difficultyMin?: number
  difficultyMax?: number
  tagAliases?: string[]
  fallbackTags?: string[]
}

export type TrainingPathDefinition = {
  id: string
  slug: string
  legacyAliases?: string[]
  title: string
  summary: string
  description: string
  visibility: TrainingPathVisibility
  level: TrainingPathLevel
  difficultyBand: TrainingPathDifficultyBand
  sortOrder: number
  chapters: TrainingPathChapterDefinition[]
}

export const TRAINING_PATH_DEFINITIONS: TrainingPathDefinition[] = [
  {
    id: "intro",
    slug: "intro",
    legacyAliases: ["algorithm-basics"],
    title: "入门路径",
    summary: "从基础语法、输入输出和简单枚举开始，建立稳定的做题节奏。",
    description:
      "适合刚进入 OJ 训练的用户。路径按照“读题与输入输出 -> 循环与枚举 -> 简单数据处理”三段展开，优先使用低难度题帮助建立基本提交与调试习惯。",
    visibility: "public",
    level: "beginner",
    difficultyBand: "intro",
    sortOrder: 10,
    chapters: [
      {
        id: "intro-basics",
        title: "基础语法与输入输出",
        summary: "先熟悉题面、输入输出与简单条件判断。",
        take: 8,
        difficultyMax: 1,
        fallbackTags: ["入门", "模拟", "基础"],
      },
      {
        id: "intro-enumeration",
        title: "循环、枚举与模拟",
        summary: "用 for / while 和枚举把过程写对，建立代码稳定性。",
        take: 8,
        difficultyMax: 2,
        tagAliases: ["枚举", "模拟", "循环"],
      },
      {
        id: "intro-data",
        title: "简单数据处理",
        summary: "继续练习字符串、数组和基础数学题。",
        take: 8,
        difficultyMax: 2,
        tagAliases: ["字符串", "数组", "数学"],
      },
    ],
  },
  {
    id: "search",
    slug: "search",
    legacyAliases: ["weekly-warmup"],
    title: "搜索路径",
    summary: "聚焦 DFS / BFS / 回溯，建立状态设计与搜索剪枝直觉。",
    description:
      "这条路径覆盖深度优先搜索、广度优先搜索、回溯与剪枝。章节按“搜索基础 -> 网格与最短步数 -> 剪枝与状态设计”推进。",
    visibility: "public",
    level: "intermediate",
    difficultyBand: "search",
    sortOrder: 20,
    chapters: [
      {
        id: "search-basics",
        title: "DFS / BFS 基础",
        summary: "先掌握最常见的搜索展开方式与访问标记。",
        take: 8,
        difficultyMin: 1,
        difficultyMax: 2,
        tagAliases: ["搜索", "深度优先搜索", "广度优先搜索", "DFS", "BFS"],
      },
      {
        id: "search-grid",
        title: "网格搜索与最短步数",
        summary: "练习迷宫、连通块和多源 BFS 的基础套路。",
        take: 8,
        difficultyMin: 1,
        difficultyMax: 3,
        tagAliases: ["广度优先搜索", "最短路", "Flood Fill", "连通块"],
      },
      {
        id: "search-pruning",
        title: "回溯、剪枝与记忆化搜索",
        summary: "开始处理状态爆炸问题，理解搜索与 DP 的边界。",
        take: 8,
        difficultyMin: 2,
        difficultyMax: 3,
        tagAliases: ["回溯", "搜索剪枝", "记忆化搜索", "折半搜索"],
      },
    ],
  },
  {
    id: "dynamic-programming",
    slug: "dynamic-programming",
    legacyAliases: ["dp", "dynamic-programming-path"],
    title: "动态规划路径",
    summary: "从状态定义入门，逐步覆盖线性 DP、背包、区间和树形 DP。",
    description:
      "动态规划是一期重点付费路径之一。未解锁时只提供路径介绍与章节摘要；VIP 或单独购买训练路径商品的用户可访问完整题目清单。",
    visibility: "membership_or_purchase",
    level: "advanced",
    difficultyBand: "dynamic_programming",
    sortOrder: 30,
    chapters: [
      {
        id: "dp-basics",
        title: "状态定义与线性 DP",
        summary: "理解状态、转移和初始化，从最常见的一维二维 DP 开始。",
        take: 10,
        difficultyMin: 1,
        difficultyMax: 2,
        tagAliases: ["动态规划", "线性动态规划", "DP"],
      },
      {
        id: "dp-knapsack-interval",
        title: "背包与区间 DP",
        summary: "练习经典背包、区间转移与决策顺序。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 3,
        tagAliases: ["背包动态规划", "区间动态规划", "状态压缩动态规划"],
      },
      {
        id: "dp-advanced",
        title: "树形与进阶状态设计",
        summary: "进入树形 DP、数位 DP 和更复杂的状态建模。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 4,
        tagAliases: ["树形动态规划", "数位动态规划", "轮廓线动态规划"],
      },
    ],
  },
  {
    id: "graph-theory",
    slug: "graph-theory",
    legacyAliases: ["graph-advanced"],
    title: "图论路径",
    summary: "围绕图遍历、最短路、并查集和连通性问题逐步强化。",
    description:
      "图论路径适合已经完成基础搜索训练的用户。路径以图的表示、遍历和最短路为核心，再扩展到连通性、并查集和图建模。",
    visibility: "membership_or_purchase",
    level: "advanced",
    difficultyBand: "graph",
    sortOrder: 40,
    chapters: [
      {
        id: "graph-basics",
        title: "图的表示与遍历",
        summary: "掌握邻接表、DFS、BFS、拓扑排序等基础套路。",
        take: 8,
        difficultyMin: 1,
        difficultyMax: 2,
        tagAliases: ["图论", "深度优先搜索", "广度优先搜索", "拓扑排序"],
      },
      {
        id: "graph-shortest-path",
        title: "最短路与图建模",
        summary: "开始处理 Dijkstra、Bellman-Ford 与图建模题。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 3,
        tagAliases: ["图论", "最短路", "图论建模"],
      },
      {
        id: "graph-connectivity",
        title: "并查集与连通性",
        summary: "把图论用于连通块、最小生成树和强连通问题。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 4,
        tagAliases: ["并查集", "最小生成树", "强连通分量", "图论"],
      },
    ],
  },
  {
    id: "advanced-algorithms",
    slug: "advanced-algorithms",
    legacyAliases: ["advanced", "advanced-topic-pack"],
    title: "高级算法路径",
    summary: "覆盖数据结构优化、复杂状态设计与高频进阶技巧，适合作为强化突破路径。",
    description:
      "这条路径面向已经有稳定刷题基础的用户，重点覆盖线段树 / 树状数组、贪心与二分答案、字符串算法和综合建模。适合在动态规划与图论之后继续冲击更高难度。",
    visibility: "membership_or_purchase",
    level: "advanced",
    difficultyBand: "advanced_algorithms",
    sortOrder: 50,
    chapters: [
      {
        id: "advanced-data-structure",
        title: "数据结构强化",
        summary: "围绕堆、单调结构、树状数组与线段树做结构化强化。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 4,
        tagAliases: ["堆", "单调栈", "单调队列", "树状数组", "线段树"],
        fallbackTags: ["数据结构", "贪心"],
      },
      {
        id: "advanced-greedy-binary",
        title: "贪心、二分与答案构造",
        summary: "练习贪心策略、二分答案和复杂构造题。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 4,
        tagAliases: ["贪心", "二分查找", "二分答案", "构造"],
        fallbackTags: ["数学", "模拟"],
      },
      {
        id: "advanced-string-mixed",
        title: "字符串与综合建模",
        summary: "进入 KMP、哈希、Trie 与更复杂的综合场景。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 5,
        tagAliases: ["字符串", "字符串哈希", "KMP", "Trie", "字典树"],
        fallbackTags: ["字符串", "图论建模"],
      },
    ],
  },
  {
    id: "interview-prep",
    slug: "interview-prep",
    legacyAliases: ["interview", "job-prep"],
    title: "算法面试路径",
    summary: "围绕面试高频题型组织训练，覆盖数组、哈希、链表、二叉树和综合模拟。",
    description:
      "面试路径更强调题型覆盖和表达训练，适合准备笔试、面试和实习招聘的用户。内容以中等难度为主，同时提供少量高频强化题帮助你建立稳定的解题节奏。",
    visibility: "membership_or_purchase",
    level: "intermediate",
    difficultyBand: "interview",
    sortOrder: 60,
    chapters: [
      {
        id: "interview-array-hash",
        title: "数组、哈希与双指针",
        summary: "先补齐面试中最常见的数组、哈希、双指针和滑动窗口题型。",
        take: 10,
        difficultyMin: 1,
        difficultyMax: 3,
        tagAliases: ["数组", "哈希", "双指针", "滑动窗口"],
        fallbackTags: ["模拟", "字符串"],
      },
      {
        id: "interview-list-tree",
        title: "链表、二叉树与递归",
        summary: "围绕链表操作、树遍历和递归思路做集中训练。",
        take: 10,
        difficultyMin: 1,
        difficultyMax: 3,
        tagAliases: ["链表", "二叉树", "树", "递归"],
        fallbackTags: ["深度优先搜索", "广度优先搜索"],
      },
      {
        id: "interview-dp-mixed",
        title: "面试综合：DP、搜索与设计",
        summary: "补齐中高频综合题，训练思路表达与边界处理。",
        take: 10,
        difficultyMin: 2,
        difficultyMax: 4,
        tagAliases: ["动态规划", "搜索", "设计", "模拟"],
        fallbackTags: ["动态规划", "图论"],
      },
    ],
  },
]

export function slugifyTrainingPathTitle(title: string) {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return normalized || "track"
}

export function buildTrainingPathSlug(id: string, title?: string) {
  const normalizedTitle = title ? slugifyTrainingPathTitle(title) : ""
  return normalizedTitle && normalizedTitle !== id ? `${id}--${normalizedTitle}` : id
}

export function extractTrainingPathId(value: string) {
  return value.split("--")[0] || value
}

export function resolveTrainingPathDefinition(value: string) {
  const id = extractTrainingPathId(value)

  return (
    TRAINING_PATH_DEFINITIONS.find(
      (item) =>
        item.id === id ||
        item.slug === id ||
        item.legacyAliases?.includes(id),
    ) ?? null
  )
}

export function getTrainingPathAccessMeta(value: string) {
  const definition = resolveTrainingPathDefinition(value)
  if (!definition) return null

  return {
    id: definition.id,
    visibility: definition.visibility,
  }
}

export function listTrainingPathDefinitions(query?: string | null) {
  const q = query?.trim().toLowerCase()
  const rows = q
    ? TRAINING_PATH_DEFINITIONS.filter((item) =>
        [item.title, item.summary, item.description].some((value) => value.toLowerCase().includes(q)),
      )
    : TRAINING_PATH_DEFINITIONS

  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getDifficultyLabel(difficulty: number | null | undefined) {
  if (difficulty === 1) return "入门"
  if (difficulty === 2) return "进阶"
  if ((difficulty ?? 0) >= 3) return "强化"
  return "未标注"
}

export function getDifficultyBadgeClass(difficulty: number | null | undefined) {
  if (difficulty === 1) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  if (difficulty === 2) return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  if ((difficulty ?? 0) >= 3) return "border-rose-500/30 bg-rose-500/10 text-rose-700"
  return "border-border/60 bg-secondary/40 text-foreground"
}

export function getTrainingPathLevelLabel(value: TrainingPathDifficultySummary | TrainingPathLevel) {
  if (typeof value === "string") {
    if (value === "beginner") return "入门路径"
    if (value === "intermediate") return "进阶路径"
    return "高级路径"
  }

  if (value.average === null) return "难度待标注"
  if (value.average < 1.6) return "入门专题"
  if (value.average < 2.4) return "进阶专题"
  return "强化专题"
}

export function getTrainingPathLevelClass(level: TrainingPathLevel) {
  if (level === "beginner") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  if (level === "intermediate") return "border-amber-500/30 bg-amber-500/10 text-amber-700"
  return "border-rose-500/30 bg-rose-500/10 text-rose-700"
}

export function formatTrainingPathProgressRate(value: number) {
  return `${Math.round(value * 100)}%`
}
