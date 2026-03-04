"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ProblemMarkdown, ProblemRichText } from "@/components/problems/problem-markdown"
import { useCopyFeedback } from "@/lib/hooks/use-copy-feedback"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"
import { parseProblemSamplesText, type ProblemSampleDraft } from "@/lib/problem-samples"
import { toast } from "sonner"

type Problem = {
  id: string
  slug: string
  title: string
  difficulty: number
  status: number
  visible: boolean
  defunct: string
  visibility: string
  source?: string | null
  tags: string[]
  version: number | null
  stats?: {
    totalSubmissions: number
    acceptedSubmissions: number
    passRate: number
  } | null
  createdAt: string
  updatedAt: string
}

type ProblemListResponse = {
  items: Problem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type QuickEditDraft = {
  id: string
  title: string
  slug: string
  difficulty: string
  visibility: string
  source: string
  tagsText: string
  status: number
  visible: boolean
  defunct: string
  version: number | null
  updatedAt: string
}

type PendingBulkAction = {
  title: string
  description: string
  confirmLabel: string
  payload: Record<string, unknown>
  requiresConfirmText?: string
}

type BulkOperationLogItem = {
  id: string
  action: string
  selectionMode: string
  filters?: {
    q?: string | null
    difficulty?: number | null
    visibility?: string | null
    status?: number | null
  } | null
  payload?: {
    visibility?: string | null
    source?: string | null
    tags?: string[]
  } | null
  matchedCount: number
  targets: Array<{
    id: string
    slug?: string | null
    title?: string | null
  }>
  createdAt: string
  admin?: {
    id: string
    email?: string | null
    name?: string | null
  } | null
  result?: {
    matchedProblems?: number
    updatedProblems?: number
    createdProblemTags?: number
    deletedProblemTags?: number
    rollbackSuggestion?: {
      kind: "problem_lifecycle" | "problem_source" | "problem_tags"
      summary: string
      capturedCount: number
      truncated: boolean
      items: Array<{
        id: string
        slug?: string | null
        title?: string | null
        visibility?: string | null
        status?: number | null
        visible?: boolean | null
        defunct?: string | null
        publishedAt?: string | null
        source?: string | null
        tags?: string[]
      }>
    } | null
  } | null
}

type BulkOperationLogResponse = {
  items: BulkOperationLogItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const VISIBILITY_OPTIONS = ["public", "private", "hidden", "contest"] as const
const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "0", label: "草稿" },
  { value: "10", label: "审核中" },
  { value: "20", label: "已发布" },
  { value: "30", label: "已归档" },
]
const BULK_TAG_ACTION_OPTIONS = [
  { value: "add_tags", label: "追加标签" },
  { value: "replace_tags", label: "覆盖标签" },
  { value: "remove_tags", label: "删除标签" },
] as const
const BULK_LOG_ACTION_OPTIONS = [
  { value: "all", label: "全部动作" },
  { value: "archive", label: "批量归档" },
  { value: "set_visibility", label: "批量改可见性" },
  { value: "set_source", label: "批量设置来源" },
  { value: "add_tags", label: "批量追加标签" },
  { value: "replace_tags", label: "批量覆盖标签" },
  { value: "remove_tags", label: "批量删除标签" },
] as const
const BULK_LOG_SELECTION_OPTIONS = [
  { value: "all", label: "全部范围" },
  { value: "ids", label: "手动勾选题目" },
  { value: "filtered", label: "筛选结果全部题目" },
] as const

function getProblemStatusLabel(status: number) {
  switch (status) {
    case 0:
      return "草稿"
    case 10:
      return "审核中"
    case 20:
      return "已发布"
    case 30:
      return "已归档"
    default:
      return `状态 ${status}`
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function parseTagsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function toQuickEditDraft(problem: Problem): QuickEditDraft {
  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: String(problem.difficulty),
    visibility: problem.visibility,
    source: problem.source ?? "",
    tagsText: problem.tags.join(", "),
    status: problem.status,
    visible: problem.visible,
    defunct: problem.defunct,
    version: problem.version,
    updatedAt: problem.updatedAt,
  }
}

function formatSelectionSummary(args: {
  selectedCount: number
  selectAllFiltered: boolean
  query: string
  difficultyFilter: string
  visibilityFilter: string
  statusFilter: string
}) {
  const base = args.selectAllFiltered
    ? `当前筛选结果全部 ${args.selectedCount} 题`
    : `已勾选的 ${args.selectedCount} 题`

  if (!args.selectAllFiltered) return base

  const filters: string[] = []
  if (args.query) filters.push(`关键词“${args.query}”`)
  if (args.difficultyFilter !== "all") filters.push(`难度 ${args.difficultyFilter}`)
  if (args.visibilityFilter !== "all") filters.push(`可见性 ${args.visibilityFilter}`)
  if (args.statusFilter !== "all") {
    const statusLabel = STATUS_OPTIONS.find((option) => option.value === args.statusFilter)?.label
    filters.push(statusLabel ?? `状态 ${args.statusFilter}`)
  }

  return filters.length ? `${base}（筛选条件：${filters.join("，")}）` : base
}

function getBulkActionLabel(action: string) {
  switch (action) {
    case "archive":
      return "批量归档"
    case "set_visibility":
      return "批量改可见性"
    case "set_source":
      return "批量设置来源"
    case "add_tags":
      return "批量追加标签"
    case "replace_tags":
      return "批量覆盖标签"
    case "remove_tags":
      return "批量删除标签"
    default:
      return action
  }
}

function describeBulkLog(log: BulkOperationLogItem) {
  if (log.action === "archive") {
    return "归档并下架题目"
  }
  if (log.action === "set_visibility") {
    return `设置可见性为 ${log.payload?.visibility ?? "-"}`
  }
  if (log.action === "set_source") {
    return log.payload?.source ? `设置来源为 ${log.payload.source}` : "清空来源"
  }
  const tags = log.payload?.tags?.length ? log.payload.tags.join("、") : "无标签"
  if (log.action === "add_tags") return `追加标签：${tags}`
  if (log.action === "replace_tags") return `覆盖标签为：${tags}`
  if (log.action === "remove_tags") return `删除标签：${tags}`
  return log.action
}

function buildAdminProblemsQueryString(input: {
  q: string
  difficultyFilter: string
  visibilityFilter: string
  statusFilter: string
  page: number
  pageSize: number
  logPage: number
  logActionFilter: string
  logSelectionModeFilter: string
  logAdminQuery: string
}) {
  const params = new URLSearchParams()
  if (input.q.trim()) params.set("q", input.q.trim())
  if (input.difficultyFilter !== "all") params.set("difficulty", input.difficultyFilter)
  if (input.visibilityFilter !== "all") params.set("visibility", input.visibilityFilter)
  if (input.statusFilter !== "all") params.set("status", input.statusFilter)
  if (input.page > 1) params.set("page", String(input.page))
  if (input.pageSize !== 50) params.set("pageSize", String(input.pageSize))
  if (input.logPage > 1) params.set("logPage", String(input.logPage))
  if (input.logActionFilter !== "all") params.set("logAction", input.logActionFilter)
  if (input.logSelectionModeFilter !== "all") {
    params.set("logSelectionMode", input.logSelectionModeFilter)
  }
  if (input.logAdminQuery.trim()) params.set("logAdminQuery", input.logAdminQuery.trim())
  return params.toString()
}

export default function AdminProblemsPage() {
  const { copied, copyText } = useCopyFeedback()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [items, setItems] = React.useState<Problem[]>([])
  const [bulkLogs, setBulkLogs] = React.useState<BulkOperationLogItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pageInput, setPageInput] = React.useState("1")
  const [pageSize, setPageSize] = React.useState(50)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [logPage, setLogPage] = React.useState(1)
  const [logPageInput, setLogPageInput] = React.useState("1")
  const [logPageSize] = React.useState(10)
  const [logTotal, setLogTotal] = React.useState(0)
  const [logTotalPages, setLogTotalPages] = React.useState(1)
  const [searchInput, setSearchInput] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [logAdminInput, setLogAdminInput] = React.useState("")
  const [logAdminQuery, setLogAdminQuery] = React.useState("")
  const [difficultyFilter, setDifficultyFilter] = React.useState("all")
  const [visibilityFilter, setVisibilityFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [logActionFilter, setLogActionFilter] =
    React.useState<(typeof BULK_LOG_ACTION_OPTIONS)[number]["value"]>("all")
  const [logSelectionModeFilter, setLogSelectionModeFilter] =
    React.useState<(typeof BULK_LOG_SELECTION_OPTIONS)[number]["value"]>("all")
  const [editingProblem, setEditingProblem] = React.useState<QuickEditDraft | null>(null)
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [selectedProblemIds, setSelectedProblemIds] = React.useState<string[]>([])
  const [selectAllFiltered, setSelectAllFiltered] = React.useState(false)
  const [bulkSaving, setBulkSaving] = React.useState(false)
  const [pendingBulkAction, setPendingBulkAction] = React.useState<PendingBulkAction | null>(null)
  const [bulkConfirmText, setBulkConfirmText] = React.useState("")
  const [recentlyAffectedProblemIds, setRecentlyAffectedProblemIds] = React.useState<string[]>([])
  const [bulkVisibility, setBulkVisibility] = React.useState<(typeof VISIBILITY_OPTIONS)[number]>(
    "public"
  )
  const [bulkSource, setBulkSource] = React.useState("")
  const [bulkTagAction, setBulkTagAction] =
    React.useState<(typeof BULK_TAG_ACTION_OPTIONS)[number]["value"]>("add_tags")
  const [bulkTagsText, setBulkTagsText] = React.useState("")
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("3")
  const [visibility, setVisibility] = React.useState("public")
  const [source, setSource] = React.useState("")
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [statement, setStatement] = React.useState("")
  const [constraints, setConstraints] = React.useState("")
  const [inputFormat, setInputFormat] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState("")
  const [samples, setSamples] = React.useState("")
  const [hints, setHints] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [timeLimitMs, setTimeLimitMs] = React.useState("1000")
  const [memoryLimitMb, setMemoryLimitMb] = React.useState("256")
  const [urlReady, setUrlReady] = React.useState(false)
  const samplePreview = React.useMemo(() => parseProblemSamplesText(samples), [samples])
  const hasDraftPreview =
    Boolean(statement.trim()) ||
    Boolean(inputFormat.trim()) ||
    Boolean(outputFormat.trim()) ||
    Boolean(constraints.trim()) ||
    Boolean(hints.trim()) ||
    Boolean(notes.trim()) ||
    Boolean(samples.trim()) ||
    Boolean(timeLimitMs.trim()) ||
    Boolean(memoryLimitMb.trim())

  const languageTags = ["scratch-必做", "scratch-可选", "C++", "Python"]

  const dataStructureTags = [
    "数组",
    "链表",
    "栈",
    "队列",
    "哈希表",
    "堆",
    "树",
    "二叉树",
    "二叉搜索树",
    "平衡树",
    "线段树",
    "树状数组",
    "图",
    "并查集",
    "字符串",
    "字典树",
    "位运算",
  ]

  const algorithmTags = [
    "双指针",
    "贪心",
    "动态规划",
    "回溯",
    "DFS",
    "BFS",
    "最短路",
    "拓扑排序",
    "最小生成树",
    "分治",
    "二分",
    "排序",
    "模拟",
    "数学",
    "数论",
    "枚举",
    "前缀和",
    "差分",
    "滑动窗口",
    "单调栈",
    "单调队列",
    "扫描线",
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }
  const visibleProblemIds = React.useMemo(() => items.map((problem) => problem.id), [items])
  const selectedVisibleCount = React.useMemo(
    () => selectedProblemIds.filter((id) => visibleProblemIds.includes(id)).length,
    [selectedProblemIds, visibleProblemIds]
  )
  const selectedCount = selectAllFiltered ? total : selectedProblemIds.length
  const allVisibleSelected =
    !selectAllFiltered &&
    visibleProblemIds.length > 0 &&
    selectedVisibleCount === visibleProblemIds.length
  const selectionSummary = React.useMemo(
    () =>
      formatSelectionSummary({
        selectedCount,
        selectAllFiltered,
        query,
        difficultyFilter,
        visibilityFilter,
        statusFilter,
      }),
    [
      selectedCount,
      selectAllFiltered,
      query,
      difficultyFilter,
      visibilityFilter,
      statusFilter,
    ]
  )

  React.useEffect(() => {
    const nextQuery = searchParams.get("q")?.trim() || ""
    const rawDifficulty = searchParams.get("difficulty")?.trim() || "all"
    const nextDifficultyFilter =
      rawDifficulty === "all" || /^\d+$/.test(rawDifficulty) ? rawDifficulty : "all"
    const rawVisibility = searchParams.get("visibility")?.trim() || "all"
    const nextVisibilityFilter =
      rawVisibility === "all" || VISIBILITY_OPTIONS.includes(rawVisibility as (typeof VISIBILITY_OPTIONS)[number])
        ? rawVisibility
        : "all"
    const rawStatus = searchParams.get("status")?.trim() || "all"
    const nextStatusFilter = STATUS_OPTIONS.some((option) => option.value === rawStatus)
      ? rawStatus
      : "all"
    const nextPage = parsePositiveInt(searchParams.get("page"), 1)
    const nextPageSize = parsePositiveInt(searchParams.get("pageSize"), 50)
    const nextLogPage = parsePositiveInt(searchParams.get("logPage"), 1)
    const rawLogAction = searchParams.get("logAction")?.trim() || "all"
    const nextLogActionFilter = BULK_LOG_ACTION_OPTIONS.some((option) => option.value === rawLogAction)
      ? rawLogAction
      : "all"
    const typedLogActionFilter =
      nextLogActionFilter as (typeof BULK_LOG_ACTION_OPTIONS)[number]["value"]
    const rawLogSelectionMode = searchParams.get("logSelectionMode")?.trim() || "all"
    const nextLogSelectionModeFilter = BULK_LOG_SELECTION_OPTIONS.some(
      (option) => option.value === rawLogSelectionMode
    )
      ? rawLogSelectionMode
      : "all"
    const typedLogSelectionModeFilter =
      nextLogSelectionModeFilter as (typeof BULK_LOG_SELECTION_OPTIONS)[number]["value"]
    const nextLogAdminQuery = searchParams.get("logAdminQuery")?.trim() || ""

    setSearchInput((current) => (current === nextQuery ? current : nextQuery))
    setQuery((current) => (current === nextQuery ? current : nextQuery))
    setDifficultyFilter((current) =>
      current === nextDifficultyFilter ? current : nextDifficultyFilter
    )
    setVisibilityFilter((current) =>
      current === nextVisibilityFilter ? current : nextVisibilityFilter
    )
    setStatusFilter((current) => (current === nextStatusFilter ? current : nextStatusFilter))
    setPage((current) => (current === nextPage ? current : nextPage))
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize))
    setPageInput((current) => (current === String(nextPage) ? current : String(nextPage)))
    setLogPage((current) => (current === nextLogPage ? current : nextLogPage))
    setLogPageInput((current) => (current === String(nextLogPage) ? current : String(nextLogPage)))
    setLogActionFilter((current) =>
      current === typedLogActionFilter ? current : typedLogActionFilter
    )
    setLogSelectionModeFilter((current) =>
      current === typedLogSelectionModeFilter ? current : typedLogSelectionModeFilter
    )
    setLogAdminInput((current) => (current === nextLogAdminQuery ? current : nextLogAdminQuery))
    setLogAdminQuery((current) => (current === nextLogAdminQuery ? current : nextLogAdminQuery))
    setUrlReady(true)
  }, [searchParams])

  const queryString = React.useMemo(
    () =>
      buildAdminProblemsQueryString({
        q: query,
        difficultyFilter,
        visibilityFilter,
        statusFilter,
        page,
        pageSize,
        logPage,
        logActionFilter,
        logSelectionModeFilter,
        logAdminQuery,
      }),
    [
      difficultyFilter,
      logActionFilter,
      logAdminQuery,
      logPage,
      logSelectionModeFilter,
      page,
      pageSize,
      query,
      statusFilter,
      visibilityFilter,
    ]
  )

  React.useEffect(() => {
    if (!urlReady) return
    if (queryString === searchParams.toString()) return
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [pathname, queryString, router, searchParams, urlReady])

  const copyCurrentViewLink = React.useCallback(async () => {
    if (typeof window === "undefined") return
    const href = `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ""}`
    await copyText(href, { errorTitle: "复制链接失败" })
  }, [copyText, pathname, queryString])

  const listUrl = React.useMemo(() => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (difficultyFilter !== "all") params.set("difficulty", difficultyFilter)
    if (visibilityFilter !== "all") params.set("visibility", visibilityFilter)
    if (statusFilter !== "all") params.set("status", statusFilter)
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))
    return `/api/admin/problems?${params.toString()}`
  }, [difficultyFilter, page, pageSize, query, statusFilter, visibilityFilter])

  const bulkLogsUrl = React.useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", String(logPage))
    params.set("pageSize", String(logPageSize))
    if (logActionFilter !== "all") params.set("action", logActionFilter)
    if (logSelectionModeFilter !== "all") params.set("selectionMode", logSelectionModeFilter)
    if (logAdminQuery) params.set("adminQuery", logAdminQuery)
    return `/api/admin/problems/bulk?${params.toString()}`
  }, [logActionFilter, logAdminQuery, logPage, logPageSize, logSelectionModeFilter])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(listUrl, { credentials: "include" })
      if (!res.ok) {
        throw new Error(`load_failed_${res.status}`)
      }
      const data = (await res.json()) as ProblemListResponse | Problem[]
      if (Array.isArray(data)) {
        setItems(data)
        setTotal(data.length)
        setTotalPages(1)
        return
      }
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? 1)
      setPageSize(data.pageSize ?? 50)
      setTotalPages(data.totalPages ?? 1)
    } catch (error) {
      toast.error("加载题库失败", {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [listUrl])

  const loadBulkLogs = React.useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch(bulkLogsUrl, {
        credentials: "include",
      })
      if (!res.ok) {
        throw new Error(`load_logs_failed_${res.status}`)
      }
      const data = (await res.json()) as Partial<BulkOperationLogResponse>
      setBulkLogs(Array.isArray(data.items) ? data.items : [])
      setLogTotal(data.total ?? 0)
      setLogPage(data.page ?? 1)
      setLogTotalPages(data.totalPages ?? 1)
    } catch (error) {
      toast.error("加载批量操作日志失败", {
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLogsLoading(false)
    }
  }, [bulkLogsUrl])

  React.useEffect(() => {
    if (!urlReady) return
    load()
  }, [load, urlReady])

  React.useEffect(() => {
    if (!urlReady) return
    loadBulkLogs()
  }, [loadBulkLogs, urlReady])

  React.useEffect(() => {
    setSelectedProblemIds((prev) => prev.filter((id) => visibleProblemIds.includes(id)))
  }, [visibleProblemIds])

  React.useEffect(() => {
    const displayPage = String(Math.min(page, Math.max(totalPages, 1)))
    setPageInput((current) => (current === displayPage ? current : displayPage))
  }, [page, totalPages])

  React.useEffect(() => {
    const displayPage = String(Math.min(logPage, Math.max(logTotalPages, 1)))
    setLogPageInput((current) => (current === displayPage ? current : displayPage))
  }, [logPage, logTotalPages])

  React.useEffect(() => {
    setSelectedProblemIds([])
    setSelectAllFiltered(false)
    setPendingBulkAction(null)
    setBulkConfirmText("")
    setRecentlyAffectedProblemIds([])
  }, [query, difficultyFilter, visibilityFilter, statusFilter])

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault()
    const nextQuery = searchInput.trim()
    const pageChanged = page !== 1
    const queryChanged = nextQuery !== query
    if (pageChanged) setPage(1)
    if (queryChanged) setQuery(nextQuery)
    if (!pageChanged && !queryChanged) load()
  }

  const submitLogSearch = (event?: React.FormEvent) => {
    event?.preventDefault()
    const nextAdminQuery = logAdminInput.trim()
    const pageChanged = logPage !== 1
    const queryChanged = nextAdminQuery !== logAdminQuery
    if (pageChanged) setLogPage(1)
    if (queryChanged) setLogAdminQuery(nextAdminQuery)
    if (!pageChanged && !queryChanged) loadBulkLogs()
  }

  const resetLogFilters = () => {
    setLogActionFilter("all")
    setLogSelectionModeFilter("all")
    setLogAdminInput("")
    setLogAdminQuery("")
    setLogPage(1)
  }

  const normalizedPageTarget = Math.min(
    Math.max(Number.parseInt(pageInput || "0", 10) || page, 1),
    Math.max(totalPages, 1)
  )
  const canJumpPage = /^\d+$/.test(pageInput) && normalizedPageTarget !== page && !loading

  const submitPageJump = () => {
    if (!canJumpPage) {
      setPageInput(String(Math.min(page, Math.max(totalPages, 1))))
      return
    }
    setPage(normalizedPageTarget)
  }

  const normalizedLogPageTarget = Math.min(
    Math.max(Number.parseInt(logPageInput || "0", 10) || logPage, 1),
    Math.max(logTotalPages, 1)
  )
  const canJumpLogPage =
    /^\d+$/.test(logPageInput) && normalizedLogPageTarget !== logPage && !logsLoading
  const problemPaginationItems = React.useMemo(
    () => buildPaginationItems(page, totalPages),
    [page, totalPages]
  )
  const logPaginationItems = React.useMemo(
    () => buildPaginationItems(logPage, logTotalPages),
    [logPage, logTotalPages]
  )
  const problemPaginationRange = React.useMemo(
    () =>
      getPaginationRange({
        page,
        pageSize,
        total,
        visibleCount: items.length,
      }),
    [items.length, page, pageSize, total]
  )
  const logPaginationRange = React.useMemo(
    () =>
      getPaginationRange({
        page: logPage,
        pageSize: logPageSize,
        total: logTotal,
        visibleCount: bulkLogs.length,
      }),
    [bulkLogs.length, logPage, logPageSize, logTotal]
  )

  const submitLogPageJump = () => {
    if (!canJumpLogPage) {
      setLogPageInput(String(Math.min(logPage, Math.max(logTotalPages, 1))))
      return
    }
    setLogPage(normalizedLogPageTarget)
  }

  const toggleProblemSelection = (problemId: string) => {
    if (selectAllFiltered) {
      toast.message("当前处于“全选筛选结果”模式", {
        description: "如需单独勾选，请先清空选择或改用“全选当前页”。",
      })
      return
    }
    setPendingBulkAction(null)
    setBulkConfirmText("")
    setRecentlyAffectedProblemIds([])
    setSelectedProblemIds((prev) =>
      prev.includes(problemId) ? prev.filter((id) => id !== problemId) : [...prev, problemId]
    )
  }

  const toggleSelectCurrentPage = () => {
    setSelectAllFiltered(false)
    setPendingBulkAction(null)
    setBulkConfirmText("")
    setRecentlyAffectedProblemIds([])
    setSelectedProblemIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleProblemIds.includes(id))
      return Array.from(new Set([...prev, ...visibleProblemIds]))
    })
  }

  const selectCurrentFilteredResults = () => {
    if (total === 0) {
      toast.error("当前筛选结果为空")
      return
    }
    setSelectedProblemIds([])
    setSelectAllFiltered(true)
    setPendingBulkAction(null)
    setBulkConfirmText("")
    setRecentlyAffectedProblemIds([])
  }

  const runBulkAction = React.useCallback(async (
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!selectAllFiltered && selectedProblemIds.length === 0) {
      toast.error("请先选择题目")
      return false
    }

    const affectedVisibleIds = selectAllFiltered
      ? [...visibleProblemIds]
      : selectedProblemIds.filter((id) => visibleProblemIds.includes(id))
    setBulkSaving(true)
    const selectionPayload = selectAllFiltered
      ? {
          selectAllMatching: true,
          filters: {
            q: query || undefined,
            difficulty:
              difficultyFilter !== "all" ? Number(difficultyFilter) : undefined,
            visibility: visibilityFilter !== "all" ? visibilityFilter : undefined,
            status: statusFilter !== "all" ? Number(statusFilter) : undefined,
          },
        }
      : {
          problemIds: selectedProblemIds,
        }
    const res = await fetch("/api/admin/problems/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...selectionPayload,
        ...payload,
      }),
    })
    setBulkSaving(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error("批量操作失败", {
        description: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
      })
      return false
    }

    const data = (await res.json().catch(() => null)) as
      | {
          matchedProblems?: number
          updatedProblems?: number
          createdProblemTags?: number
          deletedProblemTags?: number
        }
      | null

    toast.success(successMessage, {
      description:
        data && typeof data.updatedProblems === "number"
          ? `命中题目 ${data.matchedProblems ?? data.updatedProblems} 道，新增标签关系 ${data.createdProblemTags ?? 0}，移除标签关系 ${data.deletedProblemTags ?? 0}`
          : undefined,
    })
    setEditingProblem(null)
    setPendingBulkAction(null)
    setBulkConfirmText("")
    setRecentlyAffectedProblemIds(affectedVisibleIds)
    await load()
    await loadBulkLogs()
    return true
  }, [difficultyFilter, load, loadBulkLogs, query, selectAllFiltered, selectedProblemIds, statusFilter, visibilityFilter, visibleProblemIds])

  const prepareBulkVisibility = () => {
    if (selectedCount === 0) {
      toast.error("请先选择题目")
      return
    }
    setPendingBulkAction({
      title: "确认批量修改可见性",
      description: `${selectionSummary} 将统一改为 ${bulkVisibility}。`,
      confirmLabel: `确认改为 ${bulkVisibility}`,
      payload: {
        action: "set_visibility",
        visibility: bulkVisibility,
      },
    })
    setBulkConfirmText("")
  }

  const prepareBulkTags = () => {
    if (selectedCount === 0) {
      toast.error("请先选择题目")
      return
    }
    const tags = parseTagsText(bulkTagsText)
    if (tags.length === 0) {
      toast.error("请先输入标签")
      return
    }
    const actionLabel = BULK_TAG_ACTION_OPTIONS.find((option) => option.value === bulkTagAction)?.label
    setPendingBulkAction({
      title: `确认批量${actionLabel ?? "处理标签"}`,
      description: `${selectionSummary} 将执行“${actionLabel ?? "处理标签"}”：${tags.join("、")}`,
      confirmLabel: `确认${actionLabel ?? "执行"}`,
      payload: {
        action: bulkTagAction,
        tags,
      },
    })
    setBulkConfirmText("")
  }

  const confirmPendingBulkAction = async () => {
    if (!pendingBulkAction) return
    if (
      pendingBulkAction.requiresConfirmText &&
      bulkConfirmText.trim().toUpperCase() !== pendingBulkAction.requiresConfirmText.toUpperCase()
    ) {
      toast.error(`请输入 ${pendingBulkAction.requiresConfirmText} 后再确认`)
      return
    }
    const ok = await runBulkAction(
      pendingBulkAction.payload,
      pendingBulkAction.title.replace(/^确认/, "已")
    )
    if (ok) {
      setSelectedProblemIds([])
      setSelectAllFiltered(false)
      setBulkTagsText("")
      setBulkSource("")
    }
  }

  const prepareBulkArchive = () => {
    if (selectedCount === 0) {
      toast.error("请先选择题目")
      return
    }
    setPendingBulkAction({
      title: "确认批量归档题目",
      description: `${selectionSummary} 将被归档并从公开题库下架。归档会设置为 ARCHIVED、visible=false、defunct=Y、visibility=hidden。`,
      confirmLabel: "确认批量归档",
      requiresConfirmText: "ARCHIVE",
      payload: {
        action: "archive",
      },
    })
    setBulkConfirmText("")
  }

  const prepareBulkSource = () => {
    if (selectedCount === 0) {
      toast.error("请先选择题目")
      return
    }
    const normalizedSource = bulkSource.trim()
    setPendingBulkAction({
      title: normalizedSource ? "确认批量设置来源" : "确认批量清空来源",
      description: normalizedSource
        ? `${selectionSummary} 的来源将统一设置为 ${normalizedSource}。`
        : `${selectionSummary} 的来源将被清空。`,
      confirmLabel: normalizedSource ? "确认设置来源" : "确认清空来源",
      payload: {
        action: "set_source",
        source: normalizedSource || null,
      },
    })
    setBulkConfirmText("")
  }

  const createProblem = async () => {
    const payload: Record<string, unknown> = {
      title,
      difficulty: Number(difficulty),
      visibility,
      source: source || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
    }

    if (
      statement ||
      constraints ||
      inputFormat ||
      outputFormat ||
      samples ||
      hints ||
      notes
    ) {
      payload.statement = statement || ""
      payload.constraints = constraints || undefined
      payload.inputFormat = inputFormat || undefined
      payload.outputFormat = outputFormat || undefined
      payload.hints = hints || undefined
      payload.notes = notes || undefined
      payload.timeLimitMs = Number(timeLimitMs || 1000)
      payload.memoryLimitMb = Number(memoryLimitMb || 256)
      if (samples) {
        const parsedSamples = parseProblemSamplesText(samples)
        if (parsedSamples.error) {
          toast.error("样例 JSON 无法保存", { description: parsedSamples.error })
          return
        }
        payload.samples = parsedSamples.items
      }
    }

    const res = await fetch("/api/admin/problems", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error("创建题目失败", {
        description: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
      })
      return
    }

    await res.json().catch(() => null)
    toast.success("题目已创建")
    const listWillRefetchFromState =
      page !== 1 ||
      query !== "" ||
      difficultyFilter !== "all" ||
      visibilityFilter !== "all" ||
      statusFilter !== "all"
    setTitle("")
    setSelectedTags([])
    setStatement("")
    setConstraints("")
    setInputFormat("")
    setOutputFormat("")
    setSamples("")
    setHints("")
    setNotes("")
    setSource("")
    setPage(1)
    setQuery("")
    setSearchInput("")
    setShowCreateForm(false)
    setEditingProblem(null)
    if (!listWillRefetchFromState) {
      await load()
    }
  }

  const saveQuickEdit = async () => {
    if (!editingProblem) return
    if (!editingProblem.title.trim() || !editingProblem.slug.trim()) {
      toast.error("标题和 slug 不能为空")
      return
    }

    setSavingEdit(true)
    const res = await fetch(`/api/admin/problems/${editingProblem.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editingProblem.title.trim(),
        slug: editingProblem.slug.trim(),
        difficulty: Number(editingProblem.difficulty || 3),
        visibility: editingProblem.visibility,
        source: editingProblem.source.trim() || null,
        tags: parseTagsText(editingProblem.tagsText),
      }),
    })
    setSavingEdit(false)

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error("保存题目失败", {
        description: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
      })
      return
    }

    toast.success("题目基础信息已更新")
    await load()
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题库管理</h1>
          <p className="text-muted-foreground mt-2">
            先看整库列表，再做单题编辑或批量导入。当前页支持快速修改基础信息。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={copied ? "default" : "secondary"} onClick={copyCurrentViewLink}>
            {copied ? "已复制" : "复制当前筛选链接"}
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/admin/import-export">批量导入导出</Link>
          </Button>
          <Button
            variant={showCreateForm ? "outline" : "default"}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? "收起新建题目" : "新建题目"}
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/admin">返回工具页</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <form className="flex-1 space-y-3" onSubmit={submitSearch}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),repeat(4,minmax(0,1fr))]">
                <Input
                  placeholder="搜索标题 / slug / 来源 / 标签"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={difficultyFilter}
                  onChange={(event) => {
                    setDifficultyFilter(event.target.value)
                    setPage(1)
                  }}
                >
                  <option value="all">全部难度</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={String(value)}>
                      难度 {value}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={visibilityFilter}
                  onChange={(event) => {
                    setVisibilityFilter(event.target.value)
                    setPage(1)
                  }}
                >
                  <option value="all">全部可见性</option>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    setPage(1)
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    搜索
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSearchInput("")
                      setQuery("")
                      setDifficultyFilter("all")
                      setVisibilityFilter("all")
                      setStatusFilter("all")
                      setPage(1)
                    }}
                  >
                    重置
                  </Button>
                </div>
              </div>
            </form>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div>
                当前显示第 {problemPaginationRange.from}-{problemPaginationRange.to} 题，共 {problemPaginationRange.total} 题
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                {[20, 50, 100].map((value) => (
                  <option key={value} value={String(value)}>
                    每页 {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-semibold">批量操作</div>
                <div className="text-xs text-muted-foreground">
                  支持勾选当前页，或直接选择当前筛选结果的全部题目。切换筛选条件后，选择会自动清空。
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">已选 {selectedCount} 题</Badge>
                {selectAllFiltered ? (
                  <Badge variant="outline">作用范围：当前筛选结果全部题目</Badge>
                ) : null}
                <Button variant="secondary" size="sm" onClick={toggleSelectCurrentPage}>
                  {allVisibleSelected ? "取消当前页全选" : "全选当前页"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={selectCurrentFilteredResults}
                  disabled={total === 0}
                >
                  选择当前筛选结果全部题目（{total}）
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedProblemIds([])
                    setSelectAllFiltered(false)
                    setPendingBulkAction(null)
                    setBulkConfirmText("")
                  }}
                  disabled={selectedCount === 0}
                >
                  清空选择
                </Button>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="text-sm font-medium">批量归档</div>
                <div className="text-xs text-muted-foreground">
                  归档会把题目从公开题库下架，并标记为 `ARCHIVED / hidden / defunct=Y`。
                </div>
                <Button
                  variant="destructive"
                  onClick={prepareBulkArchive}
                  disabled={bulkSaving || selectedCount === 0}
                >
                  {bulkSaving ? "处理中..." : "准备批量归档"}
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="text-sm font-medium">批量改可见性</div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    value={bulkVisibility}
                    onChange={(event) => {
                      setBulkVisibility(event.target.value as (typeof VISIBILITY_OPTIONS)[number])
                      setPendingBulkAction(null)
                    }}
                  >
                    {VISIBILITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={prepareBulkVisibility}
                    disabled={bulkSaving || selectedCount === 0}
                  >
                    {bulkSaving ? "处理中..." : "准备应用可见性"}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="text-sm font-medium">批量设置来源</div>
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="来源，例如 luogu-sync / custom-import；留空表示清空来源"
                    value={bulkSource}
                    onChange={(event) => {
                      setBulkSource(event.target.value)
                      setPendingBulkAction(null)
                    }}
                  />
                  <Button
                    onClick={prepareBulkSource}
                    disabled={bulkSaving || selectedCount === 0}
                  >
                    {bulkSaving ? "处理中..." : bulkSource.trim() ? "准备设置来源" : "准备清空来源"}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                <div className="text-sm font-medium">批量设置 / 删除标签</div>
                <div className="grid gap-3 sm:grid-cols-[160px,minmax(0,1fr),auto]">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={bulkTagAction}
                    onChange={(event) => {
                      setBulkTagAction(
                        event.target.value as (typeof BULK_TAG_ACTION_OPTIONS)[number]["value"]
                      )
                      setPendingBulkAction(null)
                    }}
                  >
                    {BULK_TAG_ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="标签，逗号或换行分隔"
                    value={bulkTagsText}
                    onChange={(event) => {
                      setBulkTagsText(event.target.value)
                      setPendingBulkAction(null)
                    }}
                  />
                  <Button
                    onClick={prepareBulkTags}
                    disabled={bulkSaving || selectedCount === 0}
                  >
                    {bulkSaving ? "处理中..." : "准备应用标签"}
                  </Button>
                </div>
              </div>
            </div>
            {pendingBulkAction ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {pendingBulkAction.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pendingBulkAction.description}
                    </div>
                  </div>
                  <Badge variant="outline">执行前需要确认</Badge>
                </div>
                {pendingBulkAction.requiresConfirmText ? (
                  <div className="grid gap-2 md:max-w-sm">
                    <div className="text-xs text-muted-foreground">
                      这是危险操作。请输入 <span className="font-semibold text-foreground">{pendingBulkAction.requiresConfirmText}</span> 后才能继续。
                    </div>
                    <Input
                      placeholder={`输入 ${pendingBulkAction.requiresConfirmText}`}
                      value={bulkConfirmText}
                      onChange={(event) => setBulkConfirmText(event.target.value)}
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setPendingBulkAction(null)
                      setBulkConfirmText("")
                    }}
                    disabled={bulkSaving}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={confirmPendingBulkAction}
                    disabled={
                      bulkSaving ||
                      Boolean(
                        pendingBulkAction.requiresConfirmText &&
                          bulkConfirmText.trim().toUpperCase() !==
                            pendingBulkAction.requiresConfirmText.toUpperCase()
                      )
                    }
                  >
                    {bulkSaving ? "执行中..." : pendingBulkAction.confirmLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {editingProblem ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold">快速编辑</div>
                  <div className="text-xs text-muted-foreground">
                    当前页修改基础字段；版本、测试点、判题配置仍走完整管理页。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{getProblemStatusLabel(editingProblem.status)}</Badge>
                  <Badge variant="outline">{editingProblem.visibility}</Badge>
                  <Badge variant="outline">
                    {editingProblem.visible ? "visible" : "hidden"}
                  </Badge>
                  <Badge variant="outline">{editingProblem.defunct === "Y" ? "defunct=Y" : "defunct=N"}</Badge>
                  <Badge variant="outline">版本 {editingProblem.version ?? "-"}</Badge>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  placeholder="标题"
                  value={editingProblem.title}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, title: event.target.value } : prev
                    )
                  }
                />
                <Input
                  placeholder="slug"
                  value={editingProblem.slug}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, slug: event.target.value } : prev
                    )
                  }
                />
                <Input
                  placeholder="难度 1-10"
                  value={editingProblem.difficulty}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, difficulty: event.target.value } : prev
                    )
                  }
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={editingProblem.visibility}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, visibility: event.target.value } : prev
                    )
                  }
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="来源，可留空"
                  value={editingProblem.source}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, source: event.target.value } : prev
                    )
                  }
                />
                <Input
                  placeholder="标签，使用逗号或换行分隔"
                  value={editingProblem.tagsText}
                  onChange={(event) =>
                    setEditingProblem((prev) =>
                      prev ? { ...prev, tagsText: event.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-xs text-muted-foreground">
                  上次更新：{formatDateTime(editingProblem.updatedAt)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setEditingProblem(null)}>
                    取消
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/admin/problems/${editingProblem.id}`}>完整管理</Link>
                  </Button>
                  <Button onClick={saveQuickEdit} disabled={savingEdit}>
                    {savingEdit ? "保存中..." : "保存基础信息"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">题目列表加载中...</div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                当前筛选下没有题目。
              </div>
            ) : (
              items.map((problem) => (
                <div
                  key={problem.id}
                  className={`rounded-lg p-4 space-y-3 transition-colors ${
                    recentlyAffectedProblemIds.includes(problem.id)
                      ? "border border-emerald-500/50 bg-emerald-500/5"
                      : "border border-border/70 bg-background"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input bg-background"
                      checked={selectAllFiltered || selectedProblemIds.includes(problem.id)}
                      disabled={selectAllFiltered}
                      onChange={() => toggleProblemSelection(problem.id)}
                      aria-label={`选择题目 ${problem.title}`}
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-foreground">{problem.title}</div>
                            <Badge variant="outline">{getProblemStatusLabel(problem.status)}</Badge>
                            <Badge variant="outline">{problem.visibility}</Badge>
                            <Badge variant="outline">难度 {problem.difficulty}</Badge>
                            <Badge variant="outline">版本 {problem.version ?? "-"}</Badge>
                            {recentlyAffectedProblemIds.includes(problem.id) ? (
                              <Badge variant="outline">本次已更新</Badge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>slug: {problem.slug}</span>
                            <span>来源: {problem.source || "-"}</span>
                            <span>AC {problem.stats?.acceptedSubmissions ?? 0}/{problem.stats?.totalSubmissions ?? 0}</span>
                            <span>更新时间: {formatDateTime(problem.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingProblem(toQuickEditDraft(problem))}
                          >
                            快速编辑
                          </Button>
                          <Button size="sm" asChild>
                            <Link href={`/admin/problems/${problem.id}`}>完整管理</Link>
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {problem.tags.length ? (
                          problem.tags.map((tag) => (
                            <Badge key={`${problem.id}-${tag}`} variant="outline">
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground">暂无标签</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              当前显示第 {problemPaginationRange.from}-{problemPaginationRange.to} 题，共 {problemPaginationRange.total} 题 · 第 {Math.min(page, totalPages)} / {Math.max(totalPages, 1)} 页
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                disabled={loading || page <= 1}
                onClick={() => setPage(1)}
              >
                首页
              </Button>
              <Button
                variant="secondary"
                disabled={loading || page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {problemPaginationItems.map((item) =>
                  item.type === "ellipsis" ? (
                    <span key={item.key} className="px-2 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item.page}
                      type="button"
                      size="sm"
                      variant={item.page === page ? "default" : "secondary"}
                      className={item.page === page ? "min-w-9 font-semibold ring-2 ring-primary/35 shadow-sm" : "min-w-9"}
                      onClick={() => setPage(item.page)}
                    >
                      {item.page}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="secondary"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一页
              </Button>
              <Button
                variant="secondary"
                disabled={loading || page >= totalPages}
                onClick={() => setPage(Math.max(totalPages, 1))}
              >
                末页
              </Button>
              <div className="ml-0 flex items-center gap-2 sm:ml-2">
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
                  aria-label="输入管理员题库页码跳转"
                />
                <Button type="button" variant="secondary" onClick={submitPageJump} disabled={!canJumpPage}>
                  跳转
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold">最近批量操作</div>
              <div className="text-sm text-muted-foreground">
                记录操作者、动作、作用范围和受影响题目快照。
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              当前显示第 {logPaginationRange.from}-{logPaginationRange.to} 条，共 {logPaginationRange.total} 条 · 第 {Math.min(logPage, logTotalPages)} / {Math.max(logTotalPages, 1)} 页
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto_auto]">
            <form onSubmit={submitLogSearch} className="flex gap-2 lg:col-span-1">
              <Input
                value={logAdminInput}
                onChange={(event) => setLogAdminInput(event.target.value)}
                placeholder="按操作者姓名、邮箱或 ID 筛选"
              />
              <Button type="submit" variant="secondary" disabled={logsLoading}>
                筛选
              </Button>
            </form>

            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={logActionFilter}
              onChange={(event) => {
                setLogActionFilter(event.target.value as (typeof BULK_LOG_ACTION_OPTIONS)[number]["value"])
                setLogPage(1)
              }}
            >
              {BULK_LOG_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={logSelectionModeFilter}
              onChange={(event) => {
                setLogSelectionModeFilter(event.target.value as (typeof BULK_LOG_SELECTION_OPTIONS)[number]["value"])
                setLogPage(1)
              }}
            >
              {BULK_LOG_SELECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Button
              variant="secondary"
              onClick={resetLogFilters}
              disabled={
                logsLoading &&
                logActionFilter === "all" &&
                logSelectionModeFilter === "all" &&
                !logAdminInput &&
                !logAdminQuery
              }
            >
              重置筛选
            </Button>

            <Button variant="secondary" onClick={loadBulkLogs} disabled={logsLoading}>
              {logsLoading ? "刷新中..." : "刷新日志"}
            </Button>
          </div>

          {logsLoading && bulkLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">批量操作日志加载中...</div>
          ) : bulkLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              暂无批量操作日志。
            </div>
          ) : (
            <div className="space-y-3">
              {bulkLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border/70 bg-background p-4 space-y-3"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-foreground">
                          {getBulkActionLabel(log.action)}
                        </div>
                        <Badge variant="outline">
                          {log.selectionMode === "filtered" ? "筛选结果全部题目" : "手动勾选题目"}
                        </Badge>
                        <Badge variant="outline">命中 {log.matchedCount} 题</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        操作者：{log.admin?.name || log.admin?.email || log.admin?.id || "-"} ·
                        时间：{formatDateTime(log.createdAt)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {describeBulkLog(log)}
                      </div>
                      {log.selectionMode === "filtered" && log.filters ? (
                        <div className="text-xs text-muted-foreground">
                          筛选条件：
                          {[
                            log.filters.q ? `关键词“${log.filters.q}”` : null,
                            log.filters.difficulty ? `难度 ${log.filters.difficulty}` : null,
                            log.filters.visibility ? `可见性 ${log.filters.visibility}` : null,
                            log.filters.status !== null && log.filters.status !== undefined
                              ? getProblemStatusLabel(log.filters.status)
                              : null,
                          ]
                            .filter(Boolean)
                            .join("，") || "无"}
                        </div>
                      ) : null}
                      {log.result?.rollbackSuggestion ? (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground space-y-2">
                          <div className="font-medium text-foreground">回滚建议</div>
                          <div>{log.result.rollbackSuggestion.summary}</div>
                          <div>
                            已记录 {log.result.rollbackSuggestion.capturedCount} 题的操作前快照
                            {log.result.rollbackSuggestion.truncated ? "（此处仅展示预览）" : ""}
                          </div>
                          <div className="space-y-2">
                            {log.result.rollbackSuggestion.items.slice(0, 4).map((item) => (
                              <div
                                key={`${log.id}-rollback-${item.id}`}
                                className="rounded border border-border/60 bg-background/60 px-3 py-2"
                              >
                                <div className="font-medium text-foreground">
                                  {item.title || item.slug || item.id}
                                </div>
                                {log.result?.rollbackSuggestion?.kind === "problem_lifecycle" ? (
                                  <div>
                                    原状态：{item.visibility || "-"} / {typeof item.status === "number" ? getProblemStatusLabel(item.status) : "-"} / visible={String(item.visible)} / defunct={item.defunct || "-"} / publishedAt={formatDateTime(item.publishedAt)}
                                  </div>
                                ) : null}
                                {log.result?.rollbackSuggestion?.kind === "problem_source" ? (
                                  <div>原来源：{item.source || "-"}</div>
                                ) : null}
                                {log.result?.rollbackSuggestion?.kind === "problem_tags" ? (
                                  <div>
                                    原标签：{item.tags?.length ? item.tags.join("、") : "无标签"}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          这条旧日志没有保存操作前快照，无法给出精确回滚建议。
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      日志 ID: {log.id}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {log.targets.slice(0, 6).map((target) => (
                      <Badge key={`${log.id}-${target.id}`} variant="outline">
                        {target.title || target.slug || target.id}
                      </Badge>
                    ))}
                    {log.targets.length > 6 ? (
                      <Badge variant="outline">+{log.targets.length - 6} 题</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              当前显示第 {logPaginationRange.from}-{logPaginationRange.to} 条，共 {logPaginationRange.total} 条日志 · 第 {Math.min(logPage, logTotalPages)} / {Math.max(logTotalPages, 1)} 页
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                disabled={logsLoading || logPage <= 1}
                onClick={() => setLogPage(1)}
              >
                首页
              </Button>
              <Button
                variant="secondary"
                disabled={logsLoading || logPage <= 1}
                onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {logPaginationItems.map((item) =>
                  item.type === "ellipsis" ? (
                    <span key={item.key} className="px-2 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item.page}
                      type="button"
                      size="sm"
                      variant={item.page === logPage ? "default" : "secondary"}
                      className={item.page === logPage ? "min-w-9 font-semibold ring-2 ring-primary/35 shadow-sm" : "min-w-9"}
                      onClick={() => setLogPage(item.page)}
                    >
                      {item.page}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="secondary"
                disabled={logsLoading || logPage >= logTotalPages}
                onClick={() => setLogPage((prev) => Math.min(logTotalPages, prev + 1))}
              >
                下一页
              </Button>
              <Button
                variant="secondary"
                disabled={logsLoading || logPage >= logTotalPages}
                onClick={() => setLogPage(Math.max(logTotalPages, 1))}
              >
                末页
              </Button>
              <div className="ml-0 flex items-center gap-2 sm:ml-2">
                <span className="text-sm text-muted-foreground">跳转到</span>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={logPageInput}
                  onChange={(event) => setLogPageInput(event.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      submitLogPageJump()
                    }
                  }}
                  onBlur={submitLogPageJump}
                  className="h-10 w-20"
                  aria-label="输入批量日志页码跳转"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={submitLogPageJump}
                  disabled={!canJumpLogPage}
                >
                  跳转
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showCreateForm ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">新建题目</div>
                <div className="text-sm text-muted-foreground">
                  先创建题目和首个版本，再进入完整管理页补版本、测试点和判题配置。
                </div>
              </div>
              <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                收起
              </Button>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input
                placeholder="难度 1-10"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
              <Input
                placeholder="来源"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="可见性 public/private/hidden/contest"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                题目标签（多选）：语言 / 数据结构 / 算法
              </div>
              <TagGroup title="语言标签" tags={languageTags} selected={selectedTags} onToggle={toggleTag} />
              <TagGroup title="数据结构" tags={dataStructureTags} selected={selectedTags} onToggle={toggleTag} />
              <TagGroup title="算法标签" tags={algorithmTags} selected={selectedTags} onToggle={toggleTag} />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="时间限制 ms"
                value={timeLimitMs}
                onChange={(e) => setTimeLimitMs(e.target.value)}
              />
              <Input
                placeholder="内存限制 MB"
                value={memoryLimitMb}
                onChange={(e) => setMemoryLimitMb(e.target.value)}
              />
            </div>

            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="题目描述 statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
            <div className="grid md:grid-cols-2 gap-3">
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="输入格式 inputFormat"
                value={inputFormat}
                onChange={(e) => setInputFormat(e.target.value)}
              />
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="输出格式 outputFormat"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              />
            </div>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="约束 constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder='样例 JSON，例如 [{"input":"1","output":"2"}]'
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
            />
            <div className="grid md:grid-cols-2 gap-3">
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="提示 hints"
                value={hints}
                onChange={(e) => setHints(e.target.value)}
              />
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="备注 notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {samplePreview.error ? (
              <div className="text-xs text-red-400">
                样例 JSON 解析失败：{samplePreview.error}
              </div>
            ) : null}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">新题预览</h3>
                  <div className="text-xs text-muted-foreground">
                    这里预览的是即将创建的首个版本。
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  时限 {timeLimitMs || "1000"} ms · 内存 {memoryLimitMb || "256"} MB
                </div>
              </div>
              {!hasDraftPreview ? (
                <div className="text-sm text-muted-foreground">
                  填写题面、样例或提示后，这里会显示创建效果。
                </div>
              ) : (
                <div className="space-y-4">
                  {statement.trim() ? (
                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
                      <div className="text-sm font-medium text-foreground">题目描述</div>
                      <ProblemMarkdown markdown={statement} />
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <PreviewField title="输入格式" content={inputFormat} />
                    <PreviewField title="输出格式" content={outputFormat} />
                    <PreviewField title="约束条件" content={constraints} />
                    <PreviewField title="提示" content={hints} />
                    <PreviewField title="备注" content={notes} />
                  </div>
                  {samplePreview.error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                      样例暂时无法预览：{samplePreview.error}
                    </div>
                  ) : samplePreview.items.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-foreground">样例预览</div>
                      {samplePreview.items.map((sample, index) => (
                        <SamplePreviewCard
                          key={`${sample.input}-${sample.output}-${index}`}
                          sample={sample}
                          index={index}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={createProblem}>创建题目</Button>
              <Button variant="secondary" asChild>
                <Link href="/admin/import-export">批量导入</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function PreviewField({
  title,
  content,
}: {
  title: string
  content?: string | null
}) {
  const value = content?.trim()
  if (!value) return null

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <ProblemRichText content={value} />
    </div>
  )
}

function SamplePreviewCard({
  sample,
  index,
}: {
  sample: ProblemSampleDraft
  index: number
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">样例 {index + 1}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            输入
          </div>
          <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
            {sample.input || "(empty)"}
          </pre>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            输出
          </div>
          <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
            {sample.output || "(empty)"}
          </pre>
        </div>
      </div>
      {sample.explain?.trim() ? (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            说明
          </div>
          <ProblemRichText content={sample.explain} />
        </div>
      ) : null}
    </div>
  )
}

function TagGroup({
  title,
  tags,
  selected,
  onToggle,
}: {
  title: string
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-zinc-200">{title}</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-700"
              }`}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
