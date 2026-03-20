"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  BookOpenText,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Search,
  SlidersHorizontal,
  RotateCcw,
  X,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterBar } from "@/components/patterns/filter-bar"
import { PaginationBar } from "@/components/patterns/pagination-bar"
import { EmptyState, ErrorState } from "@/components/patterns/state-panel"
import { SectionHeading } from "@/components/patterns/section-heading"
import { useCopyFeedback } from "@/lib/hooks/use-copy-feedback"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"
import {
  LUOGU_DIFFICULTY_BANDS,
  getLuoguDifficultyBandByDifficulty,
  getLuoguDifficultyBandById,
  inferLuoguDifficultyBandFromDifficultyParam,
  isLuoguDifficultyBandId,
} from "@/lib/problem-difficulty"
import { cn } from "@/lib/utils"

type Problem = {
  id: string
  slug: string
  title: string
  difficulty: number
  source?: string | null
  version?: number | null
  tags?: string[]
  visibility?: string | null
  userStatus?: number
  bestScore?: number
  totalSubmissions?: number
  acceptedSubmissions?: number
  passRate?: number
}

type ProblemsResponse = {
  data: Problem[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const PAGE_SIZE = "12"
const USER_STATUS_OPTIONS = new Set(["NOT_STARTED", "ATTEMPTED", "ACCEPTED"])
const HIDDEN_PROBLEM_TAGS = new Set(["scratch-必做", "scratch-可选"])
const TAG_OPTIONS = Array.from(
  new Set([
    "C++",
    "Python",
    "数组",
    "链表",
    "栈",
    "队列",
    "哈希表",
    "堆",
    "树",
    "图",
    "字符串",
    "位运算",
    "双指针",
    "贪心",
    "动态规划",
    "回溯",
    "DFS",
    "BFS",
    "最短路",
    "拓扑排序",
    "二分",
    "排序",
    "模拟",
    "数学",
    "数论",
    "前缀和",
    "滑动窗口",
    "单调栈",
    "array",
    "hash-map",
    "implementation",
    "math",
  ])
)

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function parseUserStatusParam(value: string | null) {
  if (!value) return "all"
  const normalized = value.trim().toUpperCase()
  if (USER_STATUS_OPTIONS.has(normalized)) return normalized
  switch (normalized) {
    case "0":
      return "NOT_STARTED"
    case "10":
      return "ATTEMPTED"
    case "20":
      return "ACCEPTED"
    default:
      return "all"
  }
}

function buildQueryString(input: {
  keyword: string
  tagQuery: string
  difficulty: string
  userStatus: string
  page: number
  includeUserStatus: boolean
}) {
  const params = new URLSearchParams()
  if (input.keyword.trim()) params.set("keyword", input.keyword.trim())
  if (input.tagQuery.trim()) params.set("tagQuery", input.tagQuery.trim())
  if (input.difficulty !== "all") params.set("difficultyBand", input.difficulty)
  if (input.includeUserStatus && input.userStatus !== "all") {
    params.set("userStatus", input.userStatus)
  }
  if (input.page > 1) params.set("page", String(input.page))
  return params.toString()
}

function isHiddenProblemTag(tag: string) {
  return HIDDEN_PROBLEM_TAGS.has(tag.trim().toLowerCase())
}

function getTagClass(tag: string) {
  void tag
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function isTagMatch(tag: string, tagQuery: string) {
  const normalizedTag = tag.trim().toLowerCase()
  const normalizedQuery = tagQuery.trim().toLowerCase()
  if (!normalizedQuery) return false
  return normalizedTag.includes(normalizedQuery)
}

export default function ProblemsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loggedIn, loading: authLoading } = useAuth()
  const { copied, copyText } = useCopyFeedback()
  const [keyword, setKeyword] = React.useState("")
  const [tagQuery, setTagQuery] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("all")
  const [userStatus, setUserStatus] = React.useState("all")
  const [pageInput, setPageInput] = React.useState("1")
  const [tagPickerOpen, setTagPickerOpen] = React.useState(false)
  const [difficultyPickerOpen, setDifficultyPickerOpen] = React.useState(false)

  const appliedKeyword = searchParams.get("keyword") ?? searchParams.get("q") ?? ""
  const appliedTagQuery = searchParams.get("tagQuery") ?? ""
  const rawAppliedDifficultyBand = searchParams.get("difficultyBand")?.trim().toLowerCase()
  const rawAppliedDifficulty = searchParams.get("difficulty")
  const appliedDifficulty = isLuoguDifficultyBandId(rawAppliedDifficultyBand)
    ? rawAppliedDifficultyBand
    : inferLuoguDifficultyBandFromDifficultyParam(rawAppliedDifficulty)
  const appliedUserStatus = loggedIn ? parseUserStatusParam(searchParams.get("userStatus")) : "all"
  const appliedPage = parsePositiveInt(searchParams.get("page"), 1)
  const appliedDifficultyMeta =
    appliedDifficulty !== "all" && isLuoguDifficultyBandId(appliedDifficulty)
      ? getLuoguDifficultyBandById(appliedDifficulty)
      : null

  React.useEffect(() => {
    setKeyword((current) => (current === appliedKeyword ? current : appliedKeyword))
    setTagQuery((current) => (current === appliedTagQuery ? current : appliedTagQuery))
    setDifficulty((current) => (current === appliedDifficulty ? current : appliedDifficulty))
    setUserStatus((current) => (current === appliedUserStatus ? current : appliedUserStatus))
    setPageInput((current) => (current === String(appliedPage) ? current : String(appliedPage)))
  }, [appliedDifficulty, appliedKeyword, appliedPage, appliedTagQuery, appliedUserStatus])

  const activeQueryString = React.useMemo(
    () =>
      buildQueryString({
        keyword: appliedKeyword,
        tagQuery: appliedTagQuery,
        difficulty: appliedDifficulty,
        userStatus: appliedUserStatus,
        page: appliedPage,
        includeUserStatus: loggedIn,
      }),
    [appliedDifficulty, appliedKeyword, appliedPage, appliedTagQuery, appliedUserStatus, loggedIn]
  )

  const copyCurrentViewLink = React.useCallback(async () => {
    if (typeof window === "undefined") return
    const href = `${window.location.origin}${pathname}${activeQueryString ? `?${activeQueryString}` : ""}`
    await copyText(href, { errorTitle: "复制链接失败" })
  }, [activeQueryString, copyText, pathname])

  const params = React.useMemo(() => {
    const next: Record<string, string> = {
      page: String(appliedPage),
      limit: PAGE_SIZE,
    }
    if (appliedKeyword.trim()) {
      next.keyword = appliedKeyword.trim()
    }
    if (appliedTagQuery.trim()) {
      next.tagQuery = appliedTagQuery.trim()
    }
    if (appliedDifficulty !== "all") {
      next.difficultyBand = appliedDifficulty
    }
    if (loggedIn && appliedUserStatus !== "all") {
      next.userStatus = appliedUserStatus
    }
    return next
  }, [appliedDifficulty, appliedKeyword, appliedPage, appliedTagQuery, appliedUserStatus, loggedIn])

  const { data: problemsResponse, error, isLoading } = useSWR<ProblemsResponse>(
    ["/problems", params],
    () => api.problems.list<ProblemsResponse>(params)
  )

  const problems = problemsResponse?.data ?? []
  const meta = problemsResponse?.meta
  const totalPages = Math.max(meta?.totalPages ?? 1, 1)
  const currentPage = meta?.page ?? appliedPage
  const paginationItems = React.useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  )
  const paginationRange = React.useMemo(
    () =>
      getPaginationRange({
        page: currentPage,
        pageSize: meta?.limit ?? Number(PAGE_SIZE),
        total: meta?.total ?? 0,
        visibleCount: problems.length,
      }),
    [currentPage, meta?.limit, meta?.total, problems.length]
  )

  React.useEffect(() => {
    const displayPage = String(meta?.page ?? appliedPage)
    setPageInput((current) => (current === displayPage ? current : displayPage))
  }, [appliedPage, meta?.page])

  const navigateWithFilters = React.useCallback(
    (input: {
      keyword: string
      tagQuery: string
      difficulty: string
      userStatus: string
      page: number
    }) => {
      const nextQueryString = buildQueryString({
        ...input,
        includeUserStatus: loggedIn,
      })
      router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false })
    },
    [loggedIn, pathname, router]
  )

  const applyFilters = React.useCallback(() => {
    setTagPickerOpen(false)
    setDifficultyPickerOpen(false)
    navigateWithFilters({
      keyword,
      tagQuery,
      difficulty,
      userStatus,
      page: 1,
    })
  }, [difficulty, keyword, navigateWithFilters, tagQuery, userStatus])

  const resetFilters = () => {
    setKeyword("")
    setTagQuery("")
    setDifficulty("all")
    setUserStatus("all")
    setTagPickerOpen(false)
    setDifficultyPickerOpen(false)
    router.replace(pathname, { scroll: false })
  }

  const hasAppliedFilters =
    appliedKeyword.trim().length > 0 ||
    appliedTagQuery.trim().length > 0 ||
    appliedDifficulty !== "all" ||
    (loggedIn && appliedUserStatus !== "all")

  const hasPendingChanges =
    keyword !== appliedKeyword ||
    tagQuery !== appliedTagQuery ||
    difficulty !== appliedDifficulty ||
    userStatus !== appliedUserStatus

  const canResetFilters = hasPendingChanges || hasAppliedFilters

  const applyTagFilter = (tag: string) => {
    setTagQuery(tag)
    setTagPickerOpen(false)
  }

  const clearTagFilter = () => {
    setTagQuery("")
  }

  const filteredTagOptions = React.useMemo(() => {
    const normalizedTagQuery = tagQuery.trim().toLowerCase()
    return TAG_OPTIONS.filter((tag) =>
      !normalizedTagQuery ? true : tag.toLowerCase().includes(normalizedTagQuery)
    )
  }, [tagQuery])

  const jumpTarget = parsePositiveInt(pageInput, meta?.page ?? appliedPage)
  const normalizedJumpTarget = Math.min(Math.max(jumpTarget, 1), totalPages)
  const canJumpToPage =
    !isLoading &&
    Number.isFinite(Number(pageInput)) &&
    normalizedJumpTarget !== (meta?.page ?? appliedPage)

  const submitPageJump = () => {
    if (!canJumpToPage) {
      setPageInput(String(meta?.page ?? appliedPage))
      return
    }
    navigateWithFilters({
      keyword: appliedKeyword,
      tagQuery: appliedTagQuery,
      difficulty: appliedDifficulty,
      userStatus: appliedUserStatus,
      page: normalizedJumpTarget,
    })
  }

  const handleFilterKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      applyFilters()
    }
  }

  const activeSummary = (
    <>
      <span>共 {meta?.total ?? 0} 题</span>
      <span>·</span>
      <span>每页 {meta?.limit ?? Number(PAGE_SIZE)} 题</span>
      {appliedTagQuery.trim() ? (
        <>
          <span>·</span>
          <span>标签筛选 {appliedTagQuery.trim()}</span>
        </>
      ) : null}
      {appliedDifficultyMeta ? (
        <>
          <span>·</span>
          <span>{appliedDifficultyMeta.fullLabel}</span>
        </>
      ) : null}
      {loggedIn && appliedUserStatus !== "all" ? (
        <>
          <span>·</span>
          <span>个人状态已生效</span>
        </>
      ) : null}
    </>
  )

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Problem Bank"
          title="用更快的扫描节奏管理整库题目。"
          description="保留原有数据接口和筛选逻辑，只把列表、筛选和分页整理成统一的高密度工作面。"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-3 rounded-full border-[3px] border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-[6px_6px_0_hsl(var(--border))]">
                <BookOpenText className="h-4 w-4 text-foreground" />
                <span>{meta?.total ?? 0} 道题</span>
              </div>
              <div className="inline-flex items-center gap-3 rounded-full border-[3px] border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-[6px_6px_0_hsl(var(--border))]">
                <GraduationCap className="h-4 w-4 text-foreground" />
                <span>{loggedIn ? "已接入个人状态" : "未登录，仅展示公开列表"}</span>
              </div>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Focus
                </p>
                <p className="text-2xl font-semibold text-foreground">{meta?.total ?? 0}</p>
                <p className="text-sm text-muted-foreground">题目总量</p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-primary/30 p-3 text-foreground">
                <BookOpenText className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Filters
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {hasAppliedFilters ? "已启用" : "默认"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasAppliedFilters ? "当前视图已收敛到目标题集" : "当前显示完整题库视图"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-accent p-3 text-foreground">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Search
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {appliedKeyword.trim() || appliedTagQuery.trim() ? "已收敛" : "全量"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {appliedKeyword.trim() || appliedTagQuery.trim() ? "搜索条件已作用到当前题库列表" : "当前显示公开题库的默认视图"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-secondary p-3 text-foreground">
                <Search className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterBar
          title="筛选工作台"
          description="支持按题目名称模糊搜索，也支持按题号/别名搜索；调整筛选条件后，点击确认再开始查询。"
          summary={activeSummary}
          className="overflow-visible"
          actions={
            <>
              <Button type="button" variant="ghost" onClick={resetFilters} disabled={!canResetFilters}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
              <Button
                type="button"
                variant={copied ? "default" : "secondary"}
                onClick={copyCurrentViewLink}
              >
                {copied ? "已复制" : "复制当前筛选链接"}
              </Button>
            </>
          }
        >
          <div className="relative grid gap-3 xl:grid-cols-[minmax(300px,1.55fr)_minmax(280px,1.3fr)_170px_170px_120px]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="输入题目名称或题号，支持模糊搜索"
                className="pl-9"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                }}
                onKeyDown={handleFilterKeyDown}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="输入标签关键词"
                value={tagQuery}
                onChange={(event) => {
                  setTagQuery(event.target.value)
                }}
                onKeyDown={handleFilterKeyDown}
              />
              <Button
                type="button"
                variant={tagPickerOpen || tagQuery.trim() ? "secondary" : "outline"}
                className="h-11 shrink-0"
                onClick={() => {
                  setTagPickerOpen((value) => !value)
                  setDifficultyPickerOpen(false)
                }}
              >
                选择标签
              </Button>
            </div>
            <div className="relative z-30">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-between rounded-[1rem] border-[2px] bg-white px-4 text-base font-semibold shadow-none"
                onClick={() => {
                  setDifficultyPickerOpen((value) => !value)
                  setTagPickerOpen(false)
                }}
              >
                <span className="text-foreground">题目难度</span>
                {difficultyPickerOpen ? <ChevronUp className="h-5 w-5 text-foreground" /> : <ChevronDown className="h-5 w-5 text-foreground" />}
              </Button>
              {difficultyPickerOpen ? (
                <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[22rem] overflow-hidden rounded-[1.1rem] border border-slate-300 bg-[#f6f6f6] shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)]">
                  <button
                    type="button"
                    className={cn(
                      "focus-ring block w-full border-b border-slate-200 bg-white px-5 py-4 text-left text-[1rem] font-semibold transition-colors",
                      difficulty === "all" ? "text-foreground" : "text-foreground hover:bg-slate-50"
                    )}
                    onClick={() => setDifficulty("all")}
                  >
                    所有
                  </button>
                  <div className="bg-white">
                    {LUOGU_DIFFICULTY_BANDS.map((band) => (
                      <button
                        key={band.id}
                        type="button"
                        className={cn(
                          "focus-ring block w-full px-5 py-3 text-left text-[1.05rem] font-semibold transition-colors hover:bg-slate-50",
                          band.textClassName,
                          difficulty === band.id ? "bg-slate-50" : null
                        )}
                        onClick={() => setDifficulty(band.id)}
                      >
                        {band.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <select
              value={userStatus}
              onChange={(event) => {
                setUserStatus(event.target.value)
              }}
              disabled={!loggedIn}
              className="focus-ring h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3.5 text-sm shadow-[6px_6px_0_hsl(var(--border))] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <option value="all">全部状态</option>
              <option value="NOT_STARTED">未开始</option>
              <option value="ATTEMPTED">已尝试</option>
              <option value="ACCEPTED">已通过</option>
            </select>
            <Button type="button" className="h-11" onClick={applyFilters} disabled={authLoading || !hasPendingChanges}>
              确认
            </Button>
          </div>
          {tagPickerOpen ? (
            <div className="rounded-[1.5rem] border-[3px] border-border bg-white p-4 shadow-[8px_8px_0_hsl(var(--border))]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">标签选择</p>
                  <p className="text-xs text-muted-foreground">点击一个标签填入筛选框，再点确认开始搜索。</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTagPickerOpen(false)}>
                  收起
                </Button>
              </div>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
                {filteredTagOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={cn(
                      "focus-ring inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary",
                      getTagClass(tag),
                      tagQuery.trim().toLowerCase() === tag.toLowerCase()
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : null
                    )}
                    onClick={() => applyTagFilter(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {filteredTagOptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">没有匹配的标签，换个关键词试试。</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {tagQuery.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">已选标签</span>
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-1 rounded-full border-[2px] border-border bg-primary/35 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/45"
                onClick={clearTagFilter}
              >
                <span>{tagQuery.trim()}</span>
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}
        </FilterBar>

        {error ? (
          <ErrorState
            title="题库加载失败"
            description="筛选参数已保留，刷新页面或稍后重试即可；如果持续失败，再检查题库接口状态。"
          />
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} className="surface-panel overflow-hidden rounded-[1.6rem]">
                <CardContent className="overflow-x-auto px-5 py-4">
                  <div className="grid min-w-[1000px] grid-cols-[220px_minmax(180px,1fr)_80px_minmax(260px,1.35fr)_100px_90px] items-center gap-4">
                    <Skeleton className="h-12 rounded-full" />
                    <Skeleton className="h-7 rounded-lg" />
                    <Skeleton className="h-6 w-10 rounded-lg" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-16 rounded-full" />
                      <Skeleton className="h-8 w-20 rounded-full" />
                      <Skeleton className="h-8 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-6 rounded-lg" />
                    <Skeleton className="h-6 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!isLoading && !error && problems.length === 0 ? (
          <EmptyState
            title="当前筛选下没有题目"
            description="保留当前 URL 参数不变；你可以放宽难度、标签或个人状态条件，回到更大的题集。"
            href="/problems"
            actionLabel="查看全部题目"
          />
        ) : null}

        {!isLoading && !error ? (
          <div className="space-y-3">
            <div className="surface-panel hidden rounded-[1.45rem] px-5 py-3 text-sm font-semibold text-muted-foreground lg:block">
              <div className="grid grid-cols-[220px_minmax(180px,1fr)_80px_minmax(260px,1.35fr)_100px_90px] items-center gap-4">
                <span>题号</span>
                <span>题目名称</span>
                <span>难度</span>
                <span>题目标签</span>
                <span>总提交</span>
                <span>通过率</span>
              </div>
            </div>
            {problems.map((problem) => {
              const href = `/problems/${problem.slug || problem.id}`
              const difficultyMeta = getLuoguDifficultyBandByDifficulty(problem.difficulty)
              const displayTags = (problem.tags ?? []).filter((tag) => !isHiddenProblemTag(tag))
              const visibleTags = displayTags.slice(0, 4)
              const hiddenTagCount = Math.max(displayTags.length - visibleTags.length, 0)
              return (
                <Card
                  key={problem.id}
                  role="link"
                  tabIndex={0}
                  className="surface-panel cursor-pointer overflow-hidden rounded-[1.6rem] transition duration-300 hover:-translate-y-0.5 hover:shadow-[10px_10px_0_hsl(var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => router.push(href)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      router.push(href)
                    }
                  }}
                >
                  <CardContent className="overflow-x-auto px-5 py-4">
                    <div className="grid min-w-[1000px] grid-cols-[220px_minmax(180px,1fr)_80px_minmax(260px,1.35fr)_100px_90px] items-center gap-4">
                      <div className="min-w-0">
                        <span className="inline-flex max-w-full items-center rounded-full border-[2px] border-border bg-white px-3 py-2 font-mono text-sm text-muted-foreground shadow-[4px_4px_0_hsl(var(--border))]">
                          <span className="truncate">{problem.slug}</span>
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                          {problem.title}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <span
                          className={cn("text-sm font-semibold", difficultyMeta.textClassName)}
                          title={difficultyMeta.fullLabel}
                        >
                          {difficultyMeta.label}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {visibleTags.length ? (
                          <>
                            {visibleTags.map((tag) => (
                              <button
                                key={`${problem.id}-${tag}`}
                                type="button"
                                className={cn(
                                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  getTagClass(tag),
                                  isTagMatch(tag, tagQuery)
                                    ? "border-primary/50 bg-primary/15 text-primary"
                                    : null
                                )}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  applyTagFilter(tag)
                                }}
                              >
                                {tag}
                              </button>
                            ))}
                            {hiddenTagCount > 0 ? (
                              <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-slate-700">
                                +{hiddenTagCount}
                              </Badge>
                            ) : null}
                          </>
                        ) : (
                          <span className="truncate text-sm text-muted-foreground">无标签</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {problem.totalSubmissions ?? 0}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {Math.round((problem.passRate ?? 0) * 100)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}

        <PaginationBar
          range={paginationRange}
          currentPage={currentPage}
          totalPages={totalPages}
          items={paginationItems}
          loading={isLoading}
          pageNoun="题"
          pageInput={pageInput}
          canJumpToPage={canJumpToPage}
          onPageInputChange={(value) => setPageInput(value.replace(/[^\d]/g, ""))}
          onPageInputSubmit={submitPageJump}
          onPageChange={(nextPage) =>
            navigateWithFilters({
              keyword: appliedKeyword,
              tagQuery: appliedTagQuery,
              difficulty: appliedDifficulty,
              userStatus: appliedUserStatus,
              page: nextPage,
            })
          }
        />
      </div>
    </div>
  )
}
