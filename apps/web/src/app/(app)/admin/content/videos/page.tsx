"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import type { CmsAssetListResponse, CmsStatus, CmsVideoListResponse } from "@/lib/content-cms"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher<T>(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "加载失败")
  }
  return payload as T
}

export default function AdminContentVideosPage() {
  const { data: videosResponse, error: videosError, mutate: mutateVideos } = useSWR<CmsVideoListResponse>(
    "/api/admin/content/videos",
    fetcher,
  )
  const { data: assetsResponse, error: assetsError, mutate: mutateAssets } = useSWR<CmsAssetListResponse>(
    "/api/admin/content/assets",
    fetcher,
  )
  const [assetForm, setAssetForm] = React.useState({
    assetType: "video",
    title: "",
    sourceUrl: "",
    thumbnailUrl: "",
    resourceId: "",
  })
  const [creating, setCreating] = React.useState(false)

  const createAsset = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/admin/content/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: assetForm.assetType,
          title: assetForm.title,
          sourceUrl: assetForm.sourceUrl,
          thumbnailUrl: assetForm.thumbnailUrl || undefined,
          resourceType: assetForm.resourceId ? "video" : undefined,
          resourceId: assetForm.resourceId || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "资源创建失败")
      }
      setAssetForm({
        assetType: "video",
        title: "",
        sourceUrl: "",
        thumbnailUrl: "",
        resourceId: "",
      })
      await Promise.all([mutateAssets(), mutateVideos()])
      toast.success("视频资源已录入")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "资源创建失败")
    } finally {
      setCreating(false)
    }
  }

  const updateLesson = async (lessonId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/content/videos/${lessonId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result?.message || "视频内容更新失败")
    }
    await mutateVideos()
  }

  if (videosError || assetsError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">视频资源页加载失败。</div>
  }

  if (!videosResponse || !assetsResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">视频资源页加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">视频资源管理页</h1>
          <p className="mt-2 text-muted-foreground">统一录入视频资源，并与课时内容解耦维护。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/content">返回内容后台</Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-foreground">录入视频资源</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input value={assetForm.assetType} onChange={(event) => setAssetForm((current) => ({ ...current, assetType: event.target.value }))} placeholder="assetType" />
            <Input value={assetForm.title} onChange={(event) => setAssetForm((current) => ({ ...current, title: event.target.value }))} placeholder="资源标题" />
            <Input value={assetForm.sourceUrl} onChange={(event) => setAssetForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="sourceUrl" />
            <Input value={assetForm.thumbnailUrl} onChange={(event) => setAssetForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="thumbnailUrl" />
            <Input value={assetForm.resourceId} onChange={(event) => setAssetForm((current) => ({ ...current, resourceId: event.target.value }))} placeholder="绑定课时 ID（可选）" />
          </div>
          <Button onClick={createAsset} disabled={creating || !assetForm.title || !assetForm.sourceUrl}>
            {creating ? "录入中..." : "录入资源"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-foreground">资源库</h2>
          <div className="space-y-3">
            {assetsResponse.data.length ? (
              assetsResponse.data.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-border/70 bg-card px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{asset.title}</div>
                      <div className="text-sm text-muted-foreground">{asset.sourceUrl}</div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{asset.assetType}</Badge>
                      <Badge variant="outline">{asset.status}</Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">当前还没有视频资源。</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {videosResponse.data.map((video) => (
          <VideoLessonCard key={video.lessonId} item={video} onSave={updateLesson} />
        ))}
      </div>
    </div>
  )
}

function VideoLessonCard({
  item,
  onSave,
}: {
  item: CmsVideoListResponse["data"][number]
  onSave: (lessonId: string, payload: Record<string, unknown>) => Promise<void>
}) {
  const [title, setTitle] = React.useState(item.title)
  const [summary, setSummary] = React.useState(item.summary ?? "")
  const [type, setType] = React.useState(item.type)
  const [assetUri, setAssetUri] = React.useState(item.assetUri ?? "")
  const [isPreview, setIsPreview] = React.useState(item.isPreview)
  const [status, setStatus] = React.useState(item.status as CmsStatus)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave(item.lessonId, {
        title,
        summary,
        type,
        assetUri: assetUri || undefined,
        isPreview,
        status,
      })
      toast.success("视频内容已更新")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "视频内容更新失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-background">
      <CardContent className="grid gap-5 p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.courseTitle}</Badge>
            <Badge variant="outline">{item.sectionTitle}</Badge>
            <Badge variant="outline">{status}</Badge>
          </div>
          <div className="grid gap-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" />
            <textarea
              className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="摘要"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="type" />
              <Input value={assetUri} onChange={(event) => setAssetUri(event.target.value)} placeholder="assetUri" />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as CmsStatus)}
              >
                <option value="draft">draft</option>
                <option value="review">review</option>
                <option value="published">published</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} />
              公开预览
            </label>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "保存中..." : "保存视频内容"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">已关联资源</div>
          {item.assets.length ? (
            item.assets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 text-sm">
                <div className="font-medium text-foreground">{asset.title}</div>
                <div className="mt-1 text-muted-foreground">{asset.sourceUrl}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">当前没有绑定资源。</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
