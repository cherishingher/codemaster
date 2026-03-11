"use client"

import Link from "next/link"
import useSWR from "swr"
import type { ContentStudioOverviewResponse } from "@/lib/content-studio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error("题解列表加载失败")
  }
  return payload as ContentStudioOverviewResponse
}

export default function AdminContentSolutionsPage() {
  const { data, error } = useSWR("/api/admin/content/items", fetcher)

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">题解列表加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">题解列表加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题解编辑页</h1>
          <p className="mt-2 text-muted-foreground">复用现有题解模型，统一维护摘要、模板、视频解析和发布状态。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/content">返回内容后台</Link>
        </Button>
      </div>

      <div className="space-y-4">
        {data.data.solutions.length ? (
          data.data.solutions.map((item) => (
            <Card key={item.id} className="bg-background">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.problemTitle}</Badge>
                    <Badge variant="outline">{item.visibility}</Badge>
                    {item.accessLevel ? <Badge variant="outline">{item.accessLevel}</Badge> : null}
                    {item.hasVideo ? <Badge>视频解析</Badge> : null}
                  </div>
                  <div className="text-lg font-semibold text-foreground">{item.title}</div>
                  <div className="max-w-3xl text-sm text-muted-foreground">{item.summary || "暂无摘要"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/admin/content/solutions/${item.id}`}>编辑题解</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/problems/${item.problemSlug}`}>前台预览</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">当前还没有题解内容。</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
