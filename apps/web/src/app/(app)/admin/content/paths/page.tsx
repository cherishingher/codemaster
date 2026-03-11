"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import type { CmsPathListResponse } from "@/lib/content-cms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error("路径列表加载失败")
  }
  return payload as CmsPathListResponse
}

export default function AdminContentPathsPage() {
  const { data, error, mutate } = useSWR("/api/admin/content/paths", fetcher)
  const [form, setForm] = React.useState({
    title: "",
    slug: "",
    summary: "",
  })
  const [creating, setCreating] = React.useState(false)

  const createPath = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/admin/content/paths", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "路径创建失败")
      }
      setForm({ title: "", slug: "", summary: "" })
      await mutate()
      toast.success("训练路径已创建")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "路径创建失败")
    } finally {
      setCreating(false)
    }
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">路径列表加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">路径列表加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">路径编排页</h1>
          <p className="mt-2 text-muted-foreground">复用 ProblemSet 承载训练路径，支持批量关联题目和独立发布状态。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/content">返回内容后台</Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-foreground">创建训练路径</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="标题" />
            <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="slug（可选）" />
            <Input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="摘要" />
          </div>
          <Button onClick={createPath} disabled={creating || !form.title.trim()}>
            {creating ? "创建中..." : "创建路径"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.data.map((item) => (
          <Card key={item.id} className="bg-background">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.kind}</Badge>
                  <Badge variant="outline">{item.visibility}</Badge>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="text-lg font-semibold text-foreground">{item.title}</div>
                <div className="text-sm text-muted-foreground">
                  {item.summary || item.description || "暂无摘要"} · {item.itemCount} 题
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/admin/content/paths/${item.id}`}>编排路径</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/problem-sets/${item.id}`}>前台预览</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
