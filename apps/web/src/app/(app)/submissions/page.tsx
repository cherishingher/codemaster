"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  Activity,
  Clock3,
  FileCode2,
  Search,
  RotateCcw,
  Send,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FilterBar } from "@/components/patterns/filter-bar"
import { PaginationBar } from "@/components/patterns/pagination-bar"
import {
  EmptyState,
  LoadingState,
  UnauthorizedState,
} from "@/components/patterns/state-panel"
import { SectionHeading } from "@/components/patterns/section-heading"
import { useCopyFeedback } from "@/lib/hooks/use-copy-feedback"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"
import {
  getSubmissionStatusClass,
  getSubmissionStatusLabel,
} from "@/lib/submissions"

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

  const activeSummary = (
    <>
      <span>共 {meta?.total ?? 0} 条</span>
      {deferredProblemSlug.trim() ? (
        <>
          <span>·</span>
          <span>题目 {deferredProblemSlug.trim()}</span>
        </>
      ) : null}
      {language !== "all" ? (
        <>
          <span>·</span>
          <span>语言 {language}</span>
        </>
      ) : null}
      {dateFrom || dateTo ? (
        <>
          <span>·</span>
          <span>日期 {dateFrom || "起"} ~ {dateTo || "今"}</span>
        </>
      ) : null}
    </>
  )

  if (loading || !user) {
    if (loading) {
      return <LoadingState title="正在加载提交记录" description="正在恢复你的筛选条件和最近提交数据。" className="mt-12" />
    }
    return <UnauthorizedState title="需要登录后查看提交记录" description="提交历史属于个人数据，保持原有鉴权逻辑不变，未登录时仅展示未授权状态。" className="mt-12" />
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
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Submissions"
          title="把每次提交收拢成一个可扫描的执行日志。"
          description="保留原有筛选、分页和个人鉴权逻辑，只重构状态标签、资源消耗和时间信息的视觉层级。"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-3 rounded-full border-[3px] border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-[6px_6px_0_hsl(var(--border))]">
                <Send className="h-4 w-4 text-foreground" />
                <span>{meta?.total ?? 0} 条提交</span>
              </div>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </p>
                <p className="text-2xl font-semibold text-foreground">{status === "all" ? "全部" : status}</p>
                <p className="text-sm text-muted-foreground">当前结果筛选</p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-primary/30 p-3 text-foreground">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Language
                </p>
                <p className="text-2xl font-semibold text-foreground">{language === "all" ? "混合" : language}</p>
                <p className="text-sm text-muted-foreground">语言过滤器</p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-secondary p-3 text-foreground">
                <FileCode2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="surface-panel rounded-[1.8rem]">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Range
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {dateFrom || dateTo ? "已限定" : "全部"}
                </p>
                <p className="text-sm text-muted-foreground">时间窗口 {dateFrom || "起"} - {dateTo || "今"}</p>
              </div>
              <div className="rounded-[1.2rem] border-[3px] border-border bg-accent p-3 text-foreground">
                <Clock3 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterBar
          title="筛选工作台"
          description="保留 URL 同步和参数语义，只整理筛选项的阅读顺序和操作反馈。"
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
          <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.3fr)_170px_180px_170px_170px]">
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
              className="focus-ring h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3.5 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
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
              className="focus-ring h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3.5 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
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
              className="h-11"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              className="h-11"
            />
          </div>
        </FilterBar>

        <Card className="surface-panel overflow-hidden rounded-[1.95rem]">
          <CardHeader className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,184,167,0.14))]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">最近提交</CardTitle>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  按状态、题目和语言快速收束视图，回看最近一次提交更直接。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                {activeSummary}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 bg-card p-5 md:p-6">
            {isLoading ? (
              <LoadingState
                title="正在加载提交记录"
                description="数据已经开始请求，筛选参数和分页状态会保留。"
                className="max-w-none border-none bg-transparent shadow-none"
              />
            ) : null}
            {!isLoading && submissions.length === 0 ? (
              <EmptyState
                title="暂无提交记录"
                description="当前筛选条件下没有匹配提交；你可以放宽语言、日期或题目范围。"
              />
            ) : null}
            {!isLoading ? submissions.map((submission) => (
              <div
                key={submission.id}
                className="rounded-[1.6rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(227,239,248,0.88))] p-4 shadow-[8px_8px_0_hsl(var(--border))] transition hover:-translate-y-1 hover:shadow-[10px_10px_0_hsl(var(--border))]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/submissions/${submission.id}`}
                        className="rounded-full border-[2px] border-border bg-white px-3 py-1 font-mono text-xs text-muted-foreground shadow-[4px_4px_0_hsl(var(--border))] hover:text-primary"
                      >
                        #{submission.id}
                      </Link>
                      <Badge variant="outline" className={getSubmissionStatusClass(submission.status)}>
                        {getSubmissionStatusLabel(submission.status)}
                      </Badge>
                      {submission.rawStatus && submission.rawStatus !== submission.status ? (
                        <Badge variant="outline" className="border-border bg-white text-foreground">
                          {submission.rawStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Link
                        href={`/problems/${submission.problem.slug}`}
                        className="block truncate text-lg font-semibold tracking-tight text-foreground transition hover:text-primary"
                      >
                        {submission.problem.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">{new Date(submission.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">语言</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{submission.language ?? "-"}</p>
                      </div>
                      <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">分数</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{submission.score ?? 0}</p>
                      </div>
                      <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">时间</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{submission.timeUsedMs ?? 0} ms</p>
                      </div>
                      <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">内存</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{submission.memoryUsedKb ?? 0} KB</p>
                      </div>
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
              </div>
            )) : null}
          </CardContent>
        </Card>

        <PaginationBar
          range={paginationRange}
          currentPage={currentPage}
          totalPages={totalPages}
          items={paginationItems}
          loading={isLoading}
          pageNoun="条"
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
