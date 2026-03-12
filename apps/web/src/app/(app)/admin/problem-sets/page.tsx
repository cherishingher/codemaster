"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useCopyFeedback } from "@/lib/hooks/use-copy-feedback"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"

type ProblemSet = {
  id: string
  title: string
  description?: string | null
  visibility: string
  count: number
  owner?: {
    id: string
    name?: string | null
  } | null
}

type ProblemSetListResponse = {
  data?: ProblemSet[]
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    totalPages?: number
  }
  items?: ProblemSet[]
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function buildQueryString(input: { page: number; pageSize: number }) {
  const params = new URLSearchParams()
  if (input.page > 1) params.set("page", String(input.page))
  if (input.pageSize !== 20) params.set("pageSize", String(input.pageSize))
  return params.toString()
}

export default function AdminProblemSetsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { copied, copyText } = useCopyFeedback()
  const [sets, setSets] = React.useState<ProblemSet[]>([])
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [visibility, setVisibility] = React.useState("public")
  const [setId, setSetId] = React.useState("")
  const [problemId, setProblemId] = React.useState("")
  const [orderIndex, setOrderIndex] = React.useState("1")
  const [page, setPage] = React.useState(1)
  const [pageInput, setPageInput] = React.useState("1")
  const [pageSize, setPageSize] = React.useState(20)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [urlReady, setUrlReady] = React.useState(false)

  React.useEffect(() => {
    const nextPage = parsePositiveInt(searchParams.get("page"), 1)
    const nextPageSize = parsePositiveInt(searchParams.get("pageSize"), 20)
    setPage((current) => (current === nextPage ? current : nextPage))
    setPageSize((current) => (current === nextPageSize ? current : nextPageSize))
    setPageInput((current) => (current === String(nextPage) ? current : String(nextPage)))
    setUrlReady(true)
  }, [searchParams])

  const queryString = React.useMemo(
    () =>
      buildQueryString({
        page,
        pageSize,
      }),
    [page, pageSize]
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

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      const res = await fetch(`/api/admin/problem-sets?${params.toString()}`, {
        credentials: "include",
      })
      const data = (await res.json()) as ProblemSetListResponse
      const items = Array.isArray(data.data) ? data.data : Array.isArray(data.items) ? data.items : []
      const meta = data.meta ?? {}
      setSets(items)
      setTotal(meta.total ?? data.total ?? 0)
      setPage(meta.page ?? data.page ?? 1)
      setPageSize(meta.pageSize ?? data.pageSize ?? 20)
      setTotalPages(Math.max(meta.totalPages ?? data.totalPages ?? 1, 1))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  React.useEffect(() => {
    if (!urlReady) return
    load()
  }, [load, urlReady])

  React.useEffect(() => {
    const displayPage = String(Math.min(page, Math.max(totalPages, 1)))
    setPageInput((current) => (current === displayPage ? current : displayPage))
  }, [page, totalPages])

  const createSet = async () => {
    await fetch("/api/admin/problem-sets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, visibility }),
    })
    setTitle("")
    setDescription("")
    if (page !== 1) {
      setPage(1)
      return
    }
    await load()
  }

  const addItem = async () => {
    if (!setId || !problemId) return
    await fetch(`/api/admin/problem-sets/${setId}/items`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            problemId,
            orderIndex: Number(orderIndex || 1),
          },
        ],
      }),
    })
    setProblemId("")
    await load()
  }

  const normalizedPageTarget = Math.min(
    Math.max(Number.parseInt(pageInput || "0", 10) || page, 1),
    Math.max(totalPages, 1)
  )
  const canJumpPage = /^\d+$/.test(pageInput) && normalizedPageTarget !== page && !loading
  const paginationItems = React.useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages])
  const paginationRange = React.useMemo(
    () =>
      getPaginationRange({
        page,
        pageSize,
        total,
        visibleCount: sets.length,
      }),
    [page, pageSize, sets.length, total]
  )

  const submitPageJump = () => {
    if (!canJumpPage) {
      setPageInput(String(Math.min(page, Math.max(totalPages, 1))))
      return
    }
    setPage(normalizedPageTarget)
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题单管理</h1>
          <p className="mt-2 text-muted-foreground">创建题单与维护题目顺序</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={copied ? "default" : "secondary"} onClick={copyCurrentViewLink}>
            {copied ? "已复制" : "复制当前分页链接"}
          </Button>
          <Link href="/admin">
            <Button variant="secondary">返回工具页</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">创建题单</h2>
          <Input placeholder="题单标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            placeholder="描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="可见性 public/vip/purchase/private/hidden"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          />
          <Button onClick={createSet}>创建题单</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">添加题目到题单</h2>
          <Input
            placeholder="题单 ID"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="题目 ID"
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
            />
            <Input
              placeholder="排序 orderIndex"
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
            />
          </div>
          <Button onClick={addItem}>添加题目</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">题单列表</h2>
              <div className="text-sm text-muted-foreground">
                当前显示第 {paginationRange.from}-{paginationRange.to} 个题单，共 {paginationRange.total} 个题单 · 第 {Math.min(page, totalPages)} / {Math.max(totalPages, 1)} 页
              </div>
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={String(value)}>
                  每页 {value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {sets.map((s) => (
              <div key={s.id} className="border-b border-border pb-2">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.id} · {s.visibility} · {s.count} 题
                  {s.owner?.name ? ` · ${s.owner.name}` : ""}
                </div>
                {s.description ? (
                  <div className="mt-1 text-sm text-muted-foreground">{s.description}</div>
                ) : null}
              </div>
            ))}
            {!loading && sets.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无题单。</div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              当前显示第 {paginationRange.from}-{paginationRange.to} 个题单，共 {paginationRange.total} 个题单 · 第 {Math.min(page, totalPages)} / {Math.max(totalPages, 1)} 页
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={loading || page <= 1} onClick={() => setPage(1)}>
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
                  aria-label="输入题单页码跳转"
                />
                <Button type="button" variant="secondary" onClick={submitPageJump} disabled={!canJumpPage}>
                  跳转
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
