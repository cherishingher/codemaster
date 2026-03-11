"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { FileText, PlayCircle, Route, Sparkles } from "lucide-react"
import type {
  ContentStudioOverviewResponse,
  ContentStudioSolutionItem,
  ContentStudioVideoItem,
} from "@/lib/content-studio"
import { formatPriceCents, getProductTypeLabel } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function LinkedProducts({
  title,
  items,
}: {
  title: string
  items: ContentStudioOverviewResponse["data"]["solutions"][number]["linkedProducts"]
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{product.name}</div>
                <div className="text-xs text-muted-foreground">{getProductTypeLabel(product.type)}</div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatPriceCents(product.defaultSku.priceCents, product.defaultSku.currency)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">当前没有匹配商品。</div>
      )}
    </div>
  )
}

function SolutionEditorCard({
  item,
  onSaved,
}: {
  item: ContentStudioSolutionItem
  onSaved: () => Promise<unknown>
}) {
  const [summary, setSummary] = React.useState(item.summary ?? "")
  const [visibility, setVisibility] = React.useState(item.visibility)
  const [accessLevel, setAccessLevel] = React.useState(item.accessLevel ?? "")
  const [videoUrl, setVideoUrl] = React.useState(item.videoUrl ?? "")
  const [isPremium, setIsPremium] = React.useState(item.isPremium)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/content/solutions/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          visibility,
          accessLevel: accessLevel || undefined,
          videoUrl: videoUrl || undefined,
          isPremium,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "题解更新失败",
        )
      }
      await onSaved()
      toast.success("题解内容已更新")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "题解更新失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-background">
      <CardContent className="grid gap-5 p-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{item.problemTitle}</Badge>
              <Badge variant={item.hasVideo ? "default" : "outline"}>{item.hasVideo ? "含视频解析" : "纯题解"}</Badge>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
            <div className="text-sm text-muted-foreground">问题 slug：{item.problemSlug}</div>
          </div>

          <div className="grid gap-3">
            <textarea
              className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="摘要"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={visibility} onChange={(event) => setVisibility(event.target.value)} placeholder="visibility" />
              <Input value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)} placeholder="accessLevel" />
              <Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="videoUrl" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isPremium} onChange={(event) => setIsPremium(event.target.checked)} />
              作为高级题解处理
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "保存中..." : "保存题解元数据"}
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/problems/${item.problemId}`}>打开题目编辑页</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/problems/${item.problemSlug}`}>前台预览</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <LinkedProducts title="直连商品" items={item.linkedProducts} />
          <LinkedProducts title="推荐商品" items={item.suggestedProducts} />
        </div>
      </CardContent>
    </Card>
  )
}

function VideoEditorCard({
  item,
  onSaved,
}: {
  item: ContentStudioVideoItem
  onSaved: () => Promise<unknown>
}) {
  const [title, setTitle] = React.useState(item.title)
  const [summary, setSummary] = React.useState(item.summary ?? "")
  const [type, setType] = React.useState(item.type)
  const [assetUri, setAssetUri] = React.useState(item.assetUri ?? "")
  const [isPreview, setIsPreview] = React.useState(item.isPreview)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/content/videos/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          type,
          assetUri: assetUri || undefined,
          isPreview,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "视频内容更新失败",
        )
      }
      await onSaved()
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{item.courseTitle}</Badge>
              <Badge variant={item.isPreview ? "outline" : "default"}>{item.isPreview ? "公开预览" : "付费/会员"}</Badge>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
            <div className="text-sm text-muted-foreground">
              {item.sectionTitle} · {item.type}
            </div>
          </div>

          <div className="grid gap-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" />
            <textarea
              className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="摘要"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="type" />
              <Input value={assetUri} onChange={(event) => setAssetUri(event.target.value)} placeholder="assetUri" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isPreview} onChange={(event) => setIsPreview(event.target.checked)} />
              作为公开预览课时
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "保存中..." : "保存视频元数据"}
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/learn`}>前台课程页</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <LinkedProducts title="直连商品" items={item.linkedProducts} />
          <LinkedProducts title="推荐商品" items={item.suggestedProducts} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ContentStudioPage() {
  const { data, error, mutate } = useSWR<ContentStudioOverviewResponse>(
    "/admin/content/items",
    async () => {
      const response = await fetch("/api/admin/content/items", { credentials: "include" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "内容后台加载失败",
        )
      }
      return payload as ContentStudioOverviewResponse
    },
  )

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
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          Content Studio
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">内容生产后台</h1>
        <p className="text-muted-foreground">
          统一盘点题解、视频和训练路径内容状态，复用现有编辑页，并把关联商品与复购推荐放到同一个运营视图里。
        </p>
      </div>

      <Tabs defaultValue="solutions" className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl border-[2px] border-border bg-card p-2">
          <TabsTrigger value="solutions" className="rounded-xl">
            <FileText className="mr-2 size-4" />
            高级题解
          </TabsTrigger>
          <TabsTrigger value="videos" className="rounded-xl">
            <PlayCircle className="mr-2 size-4" />
            视频解析
          </TabsTrigger>
          <TabsTrigger value="paths" className="rounded-xl">
            <Route className="mr-2 size-4" />
            训练路径
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solutions" className="space-y-4">
          {data.data.solutions.length ? (
            data.data.solutions.map((item) => (
              <SolutionEditorCard key={item.id} item={item} onSaved={() => mutate()} />
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">当前还没有题解内容。</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          {data.data.videos.length ? (
            data.data.videos.map((item) => (
              <VideoEditorCard key={item.id} item={item} onSaved={() => mutate()} />
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">当前还没有视频内容。</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paths" className="space-y-4">
          {data.data.trainingPaths.length ? (
            data.data.trainingPaths.map((item) => (
              <Card key={item.id} className="bg-background">
                <CardContent className="grid gap-5 p-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{item.difficultyBand}</Badge>
                        <Badge variant="outline">{item.visibility}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm leading-7 text-muted-foreground">{item.summary}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                      <div>章节数 {item.chapterCount}</div>
                      <div>Top 标签 {item.topTags.slice(0, 3).join(" / ") || "-"}</div>
                      <div>Slug {item.slug}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.previewChapters.map((chapter) => (
                        <Badge key={chapter.id} variant="outline">
                          {chapter.title} · {chapter.problemCount} 题
                        </Badge>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button asChild variant="secondary">
                        <Link href={`/training-paths/${item.slug}`}>前台预览</Link>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <LinkedProducts title="直连商品" items={item.linkedProducts} />
                    <LinkedProducts title="推荐商品" items={item.suggestedProducts} />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">当前还没有训练路径内容。</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
