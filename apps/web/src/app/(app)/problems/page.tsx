"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Search, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { UserProblemStatus } from "@/lib/oj"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  if (value <= 1) return "bg-green-500/10 text-green-400 border-green-500/20"
  if (value === 2) return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
  return "bg-red-500/10 text-red-400 border-red-500/20"
}

function getTagClass(tag: string) {
  const normalized = tag.toLowerCase()
  if (normalized.includes("scratch") && (normalized.includes("必") || normalized.includes("must"))) {
    return "bg-red-500/10 text-red-300 border-red-500/30"
  }
  if (normalized.includes("scratch")) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
  }
  return "bg-zinc-800/70 text-zinc-200 border-zinc-700/60"
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
      className: "bg-green-500/10 text-green-400 border-green-500/20",
    }
  }
  if (status === UserProblemStatus.ATTEMPTED) {
    return {
      label: "已尝试",
      className: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
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

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题库</h1>
          <p className="mt-2 text-muted-foreground">
            按难度、完成状态和标签筛题，列表直接读取新的题库分页接口。
          </p>
        </div>
        <div className="grid w-full gap-3 md:w-auto md:grid-cols-[minmax(240px,320px)_minmax(180px,240px)_140px_140px_auto_auto_auto]">
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
          >
            {scratchOnly ? "Scratch 中" : "仅看 Scratch"}
          </Button>
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
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>共 {meta?.total ?? 0} 题</span>
        <span>·</span>
        <span>每页 {meta?.limit ?? Number(PAGE_SIZE)} 题</span>
        {tagQuery.trim() ? (
          <>
            <span>·</span>
            <span>标签筛选：{tagQuery.trim()}</span>
          </>
        ) : null}
        {loggedIn && userStatus !== "all" ? (
          <>
            <span>·</span>
            <span>已启用个人状态筛选</span>
          </>
        ) : null}
      </div>

      {tagQuery.trim() ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">当前标签筛选</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={clearTagFilter}
          >
            <span>{tagQuery.trim()}</span>
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            题库加载失败，请稍后重试。
          </div>
        ) : null}
        {isLoading ? <div className="text-sm text-muted-foreground">加载中...</div> : null}
        {!isLoading && !error && problems.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            当前筛选条件下没有题目。
          </div>
        ) : null}
        {problems.map((problem) => {
          const progress = getUserStatusMeta(problem.userStatus)
          const href = `/problems/${problem.slug || problem.id}`
          return (
            <Card
              key={problem.id}
              role="link"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => router.push(href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  router.push(href)
                }
              }}
            >
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">{problem.slug}</span>
                      <Link
                        href={href}
                        className="truncate text-lg font-medium hover:text-primary"
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
                          className="border-orange-500/30 bg-orange-500/10 text-orange-400"
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
                  <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    <span className="hidden md:inline">查看详情</span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        progress?.className ?? "bg-zinc-900 text-zinc-300"
                      )}
                    >
                      {progress?.label ?? "未开始"}
                    </span>
                  </div>
                </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          当前显示第 {paginationRange.from}-{paginationRange.to} 题，共 {paginationRange.total} 题 · 第 {currentPage} / {totalPages} 页
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage(1)}
            disabled={currentPage <= 1 || isLoading}
          >
            首页
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={currentPage <= 1 || isLoading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一页
          </Button>
          <div className="flex flex-wrap items-center gap-1">
            {paginationItems.map((item) =>
              item.type === "ellipsis" ? (
                <span key={item.key} className="px-2 text-sm text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={item.page}
                  type="button"
                  size="sm"
                  variant={item.page === currentPage ? "default" : "outline"}
                  className={item.page === currentPage ? "min-w-9 font-semibold ring-2 ring-primary/35 shadow-sm" : "min-w-9"}
                  onClick={() => setPage(item.page)}
                >
                  {item.page}
                </Button>
              )
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
            disabled={currentPage >= totalPages || isLoading || !meta?.totalPages}
          >
            下一页
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage(totalPages)}
            disabled={currentPage >= totalPages || isLoading || !meta?.totalPages}
          >
            末页
          </Button>
          <div className="ml-0 flex items-center gap-2 md:ml-2">
            <span className="text-sm text-muted-foreground">跳转到</span>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^\d]/g, "")
                setPageInput(nextValue)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  submitPageJump()
                }
              }}
              onBlur={submitPageJump}
              className="h-10 w-20"
              aria-label="输入页码跳转"
            />
            <Button type="button" variant="outline" onClick={submitPageJump} disabled={!canJumpToPage}>
              跳转
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
