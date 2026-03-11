"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type { CmsPathDetailResponse, CmsStatus } from "@/lib/content-cms"
import { formatPriceCents } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error("路径详情加载失败")
  }
  return payload as CmsPathDetailResponse
}

export default function AdminContentPathDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, error, mutate } = useSWR(`/api/admin/content/paths/${params.id}`, fetcher)
  const [savingMeta, setSavingMeta] = React.useState(false)
  const [savingItems, setSavingItems] = React.useState(false)
  const [transitioning, setTransitioning] = React.useState(false)
  const [form, setForm] = React.useState({
    title: "",
    slug: "",
    summary: "",
    description: "",
    visibility: "public",
    status: "draft" as CmsStatus,
    note: "",
    itemsText: "",
  })

  const detail = data?.data

  React.useEffect(() => {
    if (!detail) return
    setForm({
      title: detail.title,
      slug: detail.slug ?? "",
      summary: detail.summary ?? "",
      description: detail.description ?? "",
      visibility: detail.visibility,
      status: detail.status as CmsStatus,
      note: "",
      itemsText: detail.items.map((item) => `${item.problem.id},${item.orderIndex}`).join("\n"),
    })
  }, [detail])

  const saveMeta = async () => {
    setSavingMeta(true)
    try {
      const response = await fetch(`/api/admin/content/paths/${params.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug || undefined,
          summary: form.summary,
          description: form.description,
          visibility: form.visibility,
          status: form.status,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "路径元数据保存失败")
      }
      await mutate()
      toast.success("路径元数据已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "路径元数据保存失败")
    } finally {
      setSavingMeta(false)
    }
  }

  const saveItems = async () => {
    setSavingItems(true)
    try {
      const items = form.itemsText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [problemId, orderText] = line.split(",").map((item) => item.trim())
          return {
            problemId,
            orderIndex: Number(orderText || index),
          }
        })

      const response = await fetch(`/api/admin/content/paths/${params.id}/items`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "路径编排保存失败")
      }
      await mutate()
      toast.success("路径题目编排已更新")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "路径编排保存失败")
    } finally {
      setSavingItems(false)
    }
  }

  const transition = async (toStatus: CmsStatus) => {
    setTransitioning(true)
    try {
      const response = await fetch("/api/admin/content/workflow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType: "training_path",
          resourceId: params.id,
          toStatus,
          note: form.note || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "路径状态流转失败")
      }
      setForm((current) => ({ ...current, note: "" }))
      await mutate()
      toast.success(`路径已切换为 ${toStatus}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "路径状态流转失败")
    } finally {
      setTransitioning(false)
    }
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">路径详情加载失败。</div>
  }

  if (!detail) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">路径详情加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{detail.kind}</Badge>
            <Badge variant="outline">{detail.status}</Badge>
            <Badge variant="outline">{detail.visibility}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">路径批量编排</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/content/paths">返回路径列表</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">路径元数据</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="标题" />
                <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="slug" />
              </div>
              <Input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="摘要" />
              <textarea
                className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="描述"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))} placeholder="visibility" />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CmsStatus }))}
                >
                  <option value="draft">draft</option>
                  <option value="review">review</option>
                  <option value="published">published</option>
                </select>
              </div>
              <Button onClick={saveMeta} disabled={savingMeta}>
                {savingMeta ? "保存中..." : "保存路径元数据"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">批量关联题目</h2>
              <p className="text-sm text-muted-foreground">每行格式：`problemId,orderIndex`。保存时将整体替换当前路径题目。</p>
              <textarea
                className="min-h-[420px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={form.itemsText}
                onChange={(event) => setForm((current) => ({ ...current, itemsText: event.target.value }))}
              />
              <Button onClick={saveItems} disabled={savingItems}>
                {savingItems ? "保存中..." : "保存路径编排"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">状态流转</h2>
              <Input
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="审核备注（可选）"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={transitioning} onClick={() => transition("draft")}>退回草稿</Button>
                <Button variant="secondary" disabled={transitioning} onClick={() => transition("review")}>提交审核</Button>
                <Button disabled={transitioning} onClick={() => transition("published")}>发布上线</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">关联商品</h2>
              {detail.linkedProducts.length ? (
                detail.linkedProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-border/70 bg-card px-4 py-4">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatPriceCents(product.defaultSku.priceCents, product.defaultSku.currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前没有直接绑定商品。</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">审核日志</h2>
              {detail.workflowLogs.length ? (
                detail.workflowLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-foreground">{log.action}</span>
                      <Badge variant="outline">{log.toStatus}</Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      {log.operator.name || log.operator.email || log.operator.id} · {new Date(log.createdAt).toLocaleString()}
                    </div>
                    {log.note ? <div className="mt-2 text-muted-foreground">{log.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前还没有审核日志。</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
