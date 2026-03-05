"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  BookOpenText,
  GraduationCap,
  Search,
  SlidersHorizontal,
  Sparkles,
  RotateCcw,
  X,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { UserProblemStatus } from "@/lib/oj"
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
const DIFFICULTY_OPTIONS = new Set(["1", "2", "3"])
const TAG_OPTIONS = Array.from(
  new Set([
    "scratch-必做",
    "scratch-可选",
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

function hasScratchTag(searchParams: URLSearchParams) {
  const values = [
    searchParams.get("tag") ?? "",
    searchParams.get("tags") ?? "",
    ...searchParams.getAll("tag"),
    ...searchParams.getAll("tags"),
  ]
  return values.some((value) => value.toLowerCase().includes("scratch"))
}

function buildQueryString(input: {
  keyword: string
  tagQuery: string
  difficulty: string
  userStatus: string
  scratchOnly: boolean
  page: number
  includeUserStatus: boolean
}) {
  const params = new URLSearchParams()
  if (input.keyword.trim()) params.set("keyword", input.keyword.trim())
  if (input.tagQuery.trim()) params.set("tagQuery", input.tagQuery.trim())
  if (input.difficulty !== "all") params.set("difficulty", input.difficulty)
  if (input.includeUserStatus && input.userStatus !== "all") {
    params.set("userStatus", input.userStatus)
  }
  if (input.scratchOnly) params.set("tags", "scratch-必做,scratch-可选")
  if (input.page > 1) params.set("page", String(input.page))
  return params.toString()
}

function getDifficultyLabel(value: number) {
  if (value <= 1) return "简单"
  if (value === 2) return "中等"
  return "困难"
}

function getDifficultyClass(value: number) {
  if (value <= 1) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (value === 2) return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-rose-200 bg-rose-50 text-rose-700"
}

function getTagClass(tag: string) {
  const normalized = tag.toLowerCase()
  if (normalized.includes("scratch") && (normalized.includes("必") || normalized.includes("must"))) {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  if (normalized.includes("scratch")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function isTagMatch(tag: string, tagQuery: string) {
  const normalizedTag = tag.trim().toLowerCase()
  const normalizedQuery = tagQuery.trim().toLowerCase()
  if (!normalizedQuery) return false
  return normalizedTag.includes(normalizedQuery)
}

function getUserStatusMeta(status?: number) {
  if (status === UserProblemStatus.ACCEPTED) {
    return {
      label: "已通过",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  if (status === UserProblemStatus.ATTEMPTED) {
    return {
      label: "已尝试",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }
  return null
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
  const [scratchOnly, setScratchOnly] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageInput, setPageInput] = React.useState("1")
  const deferredKeyword = React.useDeferredValue(keyword)
  const deferredTagQuery = React.useDeferredValue(tagQuery)

  React.useEffect(() => {
    const nextKeyword = searchParams.get("keyword") ?? searchParams.get("q") ?? ""
    const nextTagQuery = searchParams.get("tagQuery") ?? ""
    const rawDifficulty = searchParams.get("difficulty")
    const nextDifficulty = rawDifficulty && DIFFICULTY_OPTIONS.has(rawDifficulty) ? rawDifficulty : "all"
    const nextUserStatus = loggedIn ? parseUserStatusParam(searchParams.get("userStatus")) : "all"
    const nextScratchOnly = hasScratchTag(searchParams)
    const nextPage = parsePositiveInt(searchParams.get("page"), 1)

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword))
    setTagQuery((current) => (current === nextTagQuery ? current : nextTagQuery))
    setDifficulty((current) => (current === nextDifficulty ? current : nextDifficulty))
    setUserStatus((current) => (current === nextUserStatus ? current : nextUserStatus))
    setScratchOnly((current) => (current === nextScratchOnly ? current : nextScratchOnly))
    setPage((current) => (current === nextPage ? current : nextPage))
    setPageInput((current) => (current === String(nextPage) ? current : String(nextPage)))
  }, [loggedIn, searchParams])

  const queryString = React.useMemo(
    () =>
      buildQueryString({
        keyword: deferredKeyword,
        tagQuery: deferredTagQuery,
        difficulty,
        userStatus,
        scratchOnly,
        page,
        includeUserStatus: loggedIn,
      }),
    [deferredKeyword, deferredTagQuery, difficulty, loggedIn, page, scratchOnly, userStatus]
  )

  React.useEffect(() => {
    if (authLoading) return
    if (queryString === searchParams.toString()) return
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [authLoading, pathname, queryString, router, searchParams])

  const copyCurrentViewLink = React.useCallback(async () => {
    if (typeof window === "undefined") return
    const href = `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ""}`
    await copyText(href, { errorTitle: "复制链接失败" })
  }, [copyText, pathname, queryString])

  const params = React.useMemo(() => {
    const next: Record<string, string> = {
      page: String(page),
      limit: PAGE_SIZE,
    }
    if (deferredKeyword.trim()) {
      next.keyword = deferredKeyword.trim()
    }
    if (deferredTagQuery.trim()) {
      next.tagQuery = deferredTagQuery.trim()
    }
    if (difficulty !== "all") {
      next.difficulty = difficulty
    }
    if (loggedIn && userStatus !== "all") {
      next.userStatus = userStatus
    }
    if (scratchOnly) {
      next.tags = "scratch-必做,scratch-可选"
    }
    return next
  }, [deferredKeyword, deferredTagQuery, difficulty, loggedIn, page, scratchOnly, userStatus])

  const { data: problemsResponse, error, isLoading } = useSWR<ProblemsResponse>(
    ["/problems", params],
    () => api.problems.list<ProblemsResponse>(params)
  )

  const problems = problemsResponse?.data ?? []
  const meta = problemsResponse?.meta
  const totalPages = Math.max(meta?.totalPages ?? 1, 1)
  const currentPage = meta?.page ?? page
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
    const displayPage = String(meta?.page ?? page)
    setPageInput((current) => (current === displayPage ? current : displayPage))
  }, [meta?.page, page])

  const resetFilters = () => {
    setKeyword("")
    setTagQuery("")
    setDifficulty("all")
    setUserStatus("all")
    setScratchOnly(false)
    setPage(1)
  }

  const hasActiveFilters =
    keyword.trim().length > 0 ||
    tagQuery.trim().length > 0 ||
    difficulty !== "all" ||
    (loggedIn && userStatus !== "all") ||
    scratchOnly

  const applyTagFilter = (tag: string) => {
    setTagQuery(tag)
    setPage(1)
  }

  const clearTagFilter = () => {
    setTagQuery("")
    setPage(1)
  }

  const jumpTarget = parsePositiveInt(pageInput, meta?.page ?? page)
  const normalizedJumpTarget = Math.min(Math.max(jumpTarget, 1), totalPages)
  const canJumpToPage =
    !isLoading &&
    Number.isFinite(Number(pageInput)) &&
    normalizedJumpTarget !== (meta?.page ?? page)

  const submitPageJump = () => {
    if (!canJumpToPage) {
      setPageInput(String(meta?.page ?? page))
      return
    }
    setPage(normalizedJumpTarget)
  }

  const activeSummary = (
    <>
      <span>共 {meta?.total ?? 0} 题</span>
      <span>·</span>
      <span>每页 {meta?.limit ?? Number(PAGE_SIZE)} 题</span>
      {tagQuery.trim() ? (
        <>
          <span>·</span>
          <span>标签筛选 {tagQuery.trim()}</span>
        </>
      ) : null}
      {loggedIn && userStatus !== "all" ? (
        <>
          <span>·</span>
          <span>个人状态已生效</span>
        </>
      ) : null}
      {scratchOnly ? (
        <>
          <span>·</span>
          <span>仅显示 Scratch 题</span>
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
                  {hasActiveFilters ? "已启用" : "默认"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters ? "当前视图已收敛到目标题集" : "当前显示完整题库视图"}
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
                  Scratch
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {scratchOnly ? "仅看中" : "混合"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {scratchOnly ? "必做与可选 Scratch 题目已单独聚合" : "算法题与 Scratch 题混合展示"}
                </p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-secondary p-3 text-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterBar
          title="筛选工作台"
          description="保留原有筛选参数和 URL 同步逻辑，只重构筛选区的层级、间距和交互反馈。"
          summary={activeSummary}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={resetFilters} disabled={!hasActiveFilters}>
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
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_minmax(220px,1fr)_160px_170px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索题目、slug 或标签"
                className="pl-9"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="relative">
              <Input
                list="problem-tag-options"
                placeholder="选择或输入标签"
                value={tagQuery}
                onChange={(event) => {
                  setTagQuery(event.target.value)
                  setPage(1)
                }}
              />
              <datalist id="problem-tag-options">
                {TAG_OPTIONS.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
            <select
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value)
                setPage(1)
              }}
              className="focus-ring h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3.5 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
            >
              <option value="all">全部难度</option>
              <option value="1">简单</option>
              <option value="2">中等</option>
              <option value="3">困难</option>
            </select>
            <select
              value={userStatus}
              onChange={(event) => {
                setUserStatus(event.target.value)
                setPage(1)
              }}
              disabled={!loggedIn}
              className="focus-ring h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3.5 text-sm shadow-[6px_6px_0_hsl(var(--border))] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <option value="all">全部状态</option>
              <option value="NOT_STARTED">未开始</option>
              <option value="ATTEMPTED">已尝试</option>
              <option value="ACCEPTED">已通过</option>
            </select>
            <Button
              type="button"
              variant={scratchOnly ? "default" : "outline"}
              onClick={() => {
                setScratchOnly((value) => !value)
                setPage(1)
              }}
              className="h-11"
            >
              {scratchOnly ? "正在筛 Scratch" : "仅看 Scratch"}
            </Button>
          </div>
          {tagQuery.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">当前标签筛选</span>
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
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="surface-panel rounded-[1.8rem]">
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-7 w-2/3" />
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-14 rounded-2xl" />
                    <Skeleton className="h-14 rounded-2xl" />
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
          <div className="grid gap-4 md:grid-cols-2">
            {problems.map((problem) => {
          const progress = getUserStatusMeta(problem.userStatus)
          const href = `/problems/${problem.slug || problem.id}`
          return (
            <Card
              key={problem.id}
              role="link"
              tabIndex={0}
              className="surface-panel cursor-pointer overflow-hidden rounded-[1.9rem] transition duration-300 hover:-translate-y-1 hover:shadow-[14px_14px_0_hsl(var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => router.push(href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  router.push(href)
                }
              }}
            >
              <CardContent className="p-0">
                <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,184,167,0.16))] px-6 py-5">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border-[2px] border-border bg-white px-2.5 py-1 font-mono text-xs text-muted-foreground shadow-[4px_4px_0_hsl(var(--border))]">
                        {problem.slug}
                      </span>
                      <Link
                        href={href}
                        className="truncate text-lg font-semibold tracking-tight hover:text-primary"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {problem.title}
                      </Link>
                      <Badge variant="outline" className={getDifficultyClass(problem.difficulty)}>
                        {getDifficultyLabel(problem.difficulty)}
                      </Badge>
                      {progress ? (
                        <Badge variant="outline" className={progress.className}>
                          {progress.label}
                        </Badge>
                      ) : null}
                      {problem.visibility && problem.visibility !== "public" ? (
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-700"
                        >
                          未公开
                        </Badge>
                      ) : null}
                    </div>
                    {problem.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {problem.tags.map((tag) => (
                          <button
                            key={`${problem.id}-${tag}`}
                            type="button"
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>版本 v{problem.version ?? "-"}</span>
                      <span>总提交 {problem.totalSubmissions ?? 0}</span>
                      <span>通过 {problem.acceptedSubmissions ?? 0}</span>
                      <span>通过率 {Math.round((problem.passRate ?? 0) * 100)}%</span>
                      {problem.bestScore ? <span>最好成绩 {problem.bestScore}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.3rem] border-[3px] border-border bg-white p-4 shadow-[6px_6px_0_hsl(var(--border))]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        进度
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {progress?.label ?? "未开始"}
                      </p>
                    </div>
                    <div className="rounded-[1.3rem] border-[3px] border-border bg-white p-4 shadow-[6px_6px_0_hsl(var(--border))]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        通过率
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {Math.round((problem.passRate ?? 0) * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-full border-[2px] px-3 py-1 text-xs font-medium",
                        progress?.className ?? "border-border bg-white text-foreground",
                      )}
                    >
                      {progress?.label ?? "未开始"}
                    </span>
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
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
