"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { ChevronLeft, ChevronRight, Loader2, Search, RotateCcw } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCopyFeedback } from "@/lib/hooks/use-copy-feedback"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"

type SubmissionListResponse = {
  data: Array<{
    id: string
    status: string
    rawStatus?: string
    judgeResult?: number | null
    score?: number
    language?: string | null
    timeUsedMs?: number | null
    memoryUsedKb?: number | null
    createdAt: string
    finishedAt?: string | null
    problem: {
      id: string
      slug: string
      title: string
    }
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const STATUS_OPTIONS = new Set(["AC", "WA", "TLE", "RE", "CE", "RUNNING", "QUEUED", "all"])
const LANGUAGE_PRESETS = [
  { value: "all", label: "全部语言" },
  { value: "cpp17", label: "C++17" },
  { value: "cpp14", label: "C++14" },
  { value: "cpp11", label: "C++11" },
  { value: "python", label: "Python" },
  { value: "scratch-optional", label: "Scratch（可选）" },
  { value: "scratch-must", label: "Scratch（必做）" },
]

function getStatusClass(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "bg-green-500/10 text-green-400 border-green-500/20"
    case "PARTIAL":
      return "bg-amber-500/10 text-amber-300 border-amber-500/20"
    case "PENDING":
    case "JUDGING":
      return "bg-blue-500/10 text-blue-300 border-blue-500/20"
    case "COMPILE_ERROR":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
    default:
      return "bg-red-500/10 text-red-400 border-red-500/20"
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "已通过"
    case "PARTIAL":
      return "部分通过"
    case "WRONG_ANSWER":
      return "答案错误"
    case "TIME_LIMIT_EXCEEDED":
      return "超时"
    case "MEMORY_LIMIT_EXCEEDED":
      return "超内存"
    case "RUNTIME_ERROR":
      return "运行错误"
    case "COMPILE_ERROR":
      return "编译错误"
    case "PENDING":
      return "等待中"
    case "JUDGING":
      return "评测中"
    default:
      return status
  }
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function buildQueryString(input: {
  page: number
  status: string
  problemSlug: string
  language: string
  dateFrom: string
  dateTo: string
}) {
  const params = new URLSearchParams()
  if (input.status !== "all") params.set("status", input.status)
  if (input.problemSlug.trim()) params.set("problemSlug", input.problemSlug.trim())
  if (input.language !== "all") params.set("language", input.language)
  if (input.dateFrom) params.set("dateFrom", input.dateFrom)
  if (input.dateTo) params.set("dateTo", input.dateTo)
  if (input.page > 1) params.set("page", String(input.page))
  return params.toString()
}

export default function SubmissionsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const { copied, copyText } = useCopyFeedback()
  const [page, setPage] = React.useState(1)
  const [pageInput, setPageInput] = React.useState("1")
  const [status, setStatus] = React.useState("all")
  const [problemSlug, setProblemSlug] = React.useState("")
  const [language, setLanguage] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const deferredProblemSlug = React.useDeferredValue(problemSlug)

  const languageOptions = React.useMemo(() => {
    if (!language || LANGUAGE_PRESETS.some((item) => item.value === language)) {
      return LANGUAGE_PRESETS
    }
    return [...LANGUAGE_PRESETS, { value: language, label: language }]
  }, [language])

  React.useEffect(() => {
    const rawStatus = searchParams.get("status")?.trim() || "all"
    const nextStatus = STATUS_OPTIONS.has(rawStatus) ? rawStatus : "all"
    const nextProblemSlug = searchParams.get("problemSlug")?.trim() || ""
    const nextLanguage = searchParams.get("language")?.trim() || "all"
    const nextDateFrom = searchParams.get("dateFrom")?.trim() || ""
    const nextDateTo = searchParams.get("dateTo")?.trim() || ""
    const nextPage = parsePositiveInt(searchParams.get("page"), 1)

    setStatus((current) => (current === nextStatus ? current : nextStatus))
    setProblemSlug((current) => (current === nextProblemSlug ? current : nextProblemSlug))
    setLanguage((current) => (current === nextLanguage ? current : nextLanguage))
    setDateFrom((current) => (current === nextDateFrom ? current : nextDateFrom))
    setDateTo((current) => (current === nextDateTo ? current : nextDateTo))
    setPage((current) => (current === nextPage ? current : nextPage))
    setPageInput((current) => (current === String(nextPage) ? current : String(nextPage)))
  }, [searchParams])

  const queryString = React.useMemo(
    () =>
      buildQueryString({
        page,
        status,
        problemSlug: deferredProblemSlug,
        language,
        dateFrom,
        dateTo,
      }),
    [dateFrom, dateTo, deferredProblemSlug, language, page, status]
  )

  React.useEffect(() => {
    if (queryString === searchParams.toString()) return
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [pathname, queryString, router, searchParams])

  const copyCurrentViewLink = React.useCallback(async () => {
    if (typeof window === "undefined") return
    const href = `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ""}`
    await copyText(href, { errorTitle: "复制链接失败" })
  }, [copyText, pathname, queryString])

  const params = React.useMemo(() => {
    const next: Record<string, string> = {
      page: String(page),
      limit: "20",
    }
    if (status !== "all") {
      next.status = status
    }
    if (deferredProblemSlug.trim()) {
      next.problemSlug = deferredProblemSlug.trim()
    }
    if (language !== "all") {
      next.language = language
    }
    if (dateFrom) {
      next.dateFrom = dateFrom
    }
    if (dateTo) {
      next.dateTo = dateTo
    }
    return next
  }, [dateFrom, dateTo, deferredProblemSlug, language, page, status])

  const { data, isLoading } = useSWR<SubmissionListResponse>(
    user ? ["/submissions", params] : null,
    () => api.submissions.list<SubmissionListResponse>(params)
  )

  const submissions = data?.data ?? []
  const meta = data?.meta
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
        pageSize: meta?.limit ?? 20,
        total: meta?.total ?? 0,
        visibleCount: submissions.length,
      }),
    [currentPage, meta?.limit, meta?.total, submissions.length]
  )

  React.useEffect(() => {
    const displayPage = String(meta?.page ?? page)
    setPageInput((current) => (current === displayPage ? current : displayPage))
  }, [meta?.page, page])

  const jumpTarget = parsePositiveInt(pageInput, meta?.page ?? page)
  const normalizedJumpTarget = Math.min(Math.max(jumpTarget, 1), totalPages)
  const canJumpToPage =
    !isLoading &&
    /^\d+$/.test(pageInput) &&
    normalizedJumpTarget !== (meta?.page ?? page)

  const submitPageJump = () => {
    if (!canJumpToPage) {
      setPageInput(String(meta?.page ?? page))
      return
    }
    setPage(normalizedJumpTarget)
  }
  const hasActiveFilters =
    status !== "all" ||
    problemSlug.trim().length > 0 ||
    language !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const resetFilters = () => {
    setStatus("all")
    setProblemSlug("")
    setLanguage("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  return (
    <div className="container px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">提交记录</h1>
            <p className="mt-2 text-muted-foreground">
              查看自己的提交历史、原始判题状态和资源消耗。
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(220px,260px)_160px_160px_160px_160px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={problemSlug}
              onChange={(event) => {
                setProblemSlug(event.target.value)
                setPage(1)
              }}
              placeholder="按题目 slug 过滤"
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部结果</option>
            <option value="AC">AC</option>
            <option value="WA">WA</option>
            <option value="TLE">TLE</option>
            <option value="RE">RE</option>
            <option value="CE">CE</option>
            <option value="RUNNING">RUNNING</option>
            <option value="QUEUED">QUEUED</option>
          </select>
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value)
              setPage(1)
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setPage(1)
            }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setPage(1)
            }}
          />
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>最近提交</CardTitle>
          <div className="text-sm text-muted-foreground">
            共 {meta?.total ?? 0} 条
            {deferredProblemSlug.trim() ? ` · 题目 ${deferredProblemSlug.trim()}` : ""}
            {language !== "all" ? ` · 语言 ${language}` : ""}
            {dateFrom || dateTo ? ` · 日期 ${dateFrom || "起"} ~ ${dateTo || "今"}` : ""}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <div className="text-sm text-muted-foreground">加载中...</div> : null}
          {!isLoading && submissions.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无提交记录。</div>
          ) : null}
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/submissions/${submission.id}`}
                    className="font-medium hover:underline"
                  >
                    #{submission.id}
                  </Link>
                  <Badge variant="outline" className={getStatusClass(submission.status)}>
                    {getStatusLabel(submission.status)}
                  </Badge>
                  {submission.rawStatus && submission.rawStatus !== submission.status ? (
                    <Badge variant="outline">{submission.rawStatus}</Badge>
                  ) : null}
                </div>
                <div className="text-sm">
                  <Link
                    href={`/problems/${submission.problem.slug}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {submission.problem.title}
                  </Link>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>语言 {submission.language ?? "-"}</span>
                  <span>分数 {submission.score ?? 0}</span>
                  <span>时间 {submission.timeUsedMs ?? 0} ms</span>
                  <span>内存 {submission.memoryUsedKb ?? 0} KB</span>
                  <span>{new Date(submission.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/problems/${submission.problem.slug}`}>题目</Link>
                </Button>
                <Button asChild>
                  <Link href={`/submissions/${submission.id}`}>详情</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          当前显示第 {paginationRange.from}-{paginationRange.to} 条，共 {paginationRange.total} 条提交 · 第 {currentPage} / {totalPages} 页
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
              onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  submitPageJump()
                }
              }}
              onBlur={submitPageJump}
              className="h-10 w-20"
              aria-label="输入提交页码跳转"
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
