"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import type { CmsWorkflowLogListResponse } from "@/lib/content-cms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error("审核日志加载失败")
  }
  return payload as CmsWorkflowLogListResponse
}

export default function AdminContentWorkflowPage() {
  const [resourceType, setResourceType] = React.useState("")
  const [resourceId, setResourceId] = React.useState("")
  const query = React.useMemo(() => {
    const params = new URLSearchParams()
    if (resourceType) params.set("resourceType", resourceType)
    if (resourceId) params.set("resourceId", resourceId)
    const text = params.toString()
    return `/api/admin/content/workflow-logs${text ? `?${text}` : ""}`
  }, [resourceId, resourceType])

  const { data, error } = useSWR(query, fetcher)

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">审核日志加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">审核日志加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">审核日志说明</h1>
          <p className="mt-2 text-muted-foreground">每次内容状态流转都会同时写入 ContentWorkflowLog 和现有 ModerationLog。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/content">返回内容后台</Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="grid gap-3 p-6 md:grid-cols-3">
          <Input value={resourceType} onChange={(event) => setResourceType(event.target.value)} placeholder="resourceType" />
          <Input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="resourceId" />
          <div className="text-sm text-muted-foreground">
            支持按 `solution / video / training_path` 和具体资源 ID 过滤。
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.data.length ? (
          data.data.map((log) => (
            <Card key={log.id} className="bg-background">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{log.resourceType}</Badge>
                    <Badge variant="outline">{log.toStatus}</Badge>
                    {log.fromStatus ? <Badge variant="outline">{log.fromStatus}</Badge> : null}
                  </div>
                  <div className="font-medium text-foreground">{log.resourceId}</div>
                  <div className="text-sm text-muted-foreground">
                    {log.operator.name || log.operator.email || log.operator.id} · {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {log.note ? <div className="text-sm text-muted-foreground">{log.note}</div> : null}
                </div>
                <div className="text-sm font-medium text-foreground">{log.action}</div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">当前没有符合条件的审核日志。</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
