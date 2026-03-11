"use client"

import Link from "next/link"
import useSWR from "swr"
import { FileText, PlayCircle, Route, Workflow } from "lucide-react"
import type { CmsOverviewResponse } from "@/lib/content-cms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const resourceMeta = {
  solution: { label: "题解", icon: FileText, href: "/admin/content/solutions" },
  video: { label: "视频", icon: PlayCircle, href: "/admin/content/videos" },
  training_path: { label: "训练路径", icon: Route, href: "/admin/content/paths" },
} as const

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "内容后台加载失败",
    )
  }
  return payload as CmsOverviewResponse
}

export function ContentCmsDashboard() {
  const { data, error } = useSWR("/api/admin/content/overview", fetcher)

  if (error) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">内容后台加载失败，请稍后重试。</CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">内容后台加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">内容状态管理</h1>
          <p className="text-muted-foreground">
            统一管理题解、视频、训练路径内容状态，保留草稿和审核过程，并追踪发布日志。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/content/videos">视频资源管理</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/content/paths">路径编排</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/content/workflow">审核日志</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.entries(resourceMeta).map(([key, meta]) => {
          const counts = data.data.counts[key as keyof typeof data.data.counts]
          const Icon = meta.icon

          return (
            <Card key={key} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <Icon className="size-4 text-primary" />
                    {meta.label}
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={meta.href}>进入管理</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-4 text-center">
                    <div className="text-xs text-muted-foreground">草稿</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{counts.draft}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-4 text-center">
                    <div className="text-xs text-muted-foreground">待审</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{counts.review}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-4 text-center">
                    <div className="text-xs text-muted-foreground">已发布</div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{counts.published}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">最近状态流转</h2>
          </div>
          <div className="space-y-3">
            {data.data.recentLogs.length ? (
              data.data.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-4"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {log.resourceType} / {log.resourceId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.operator.name || log.operator.email || log.operator.id} · {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.fromStatus ? <Badge variant="outline">{log.fromStatus}</Badge> : null}
                    <Badge>{log.toStatus}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">当前还没有内容状态流转记录。</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
