"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type { CmsSolutionDetailResponse, CmsStatus, CmsStatusTransitionInput } from "@/lib/content-cms"
import { SOLUTION_TEMPLATE_OPTIONS } from "@/lib/content-cms"
import { formatPriceCents } from "@/lib/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error("题解详情加载失败")
  }
  return payload as CmsSolutionDetailResponse
}

export default function AdminContentSolutionDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, error, mutate } = useSWR(`/api/admin/content/solutions/${params.id}`, fetcher)
  const [saving, setSaving] = React.useState(false)
  const [transitioning, setTransitioning] = React.useState(false)

  const solution = data?.data
  const [form, setForm] = React.useState({
    title: "",
    summary: "",
    content: "",
    templateType: "",
    visibility: "public",
    accessLevel: "",
    videoUrl: "",
    isPremium: false,
    note: "",
  })

  React.useEffect(() => {
    if (!solution) return
    setForm({
      title: solution.title,
      summary: solution.summary ?? "",
      content: solution.content,
      templateType: solution.templateType ?? "",
      visibility: solution.visibility,
      accessLevel: solution.accessLevel ?? "",
      videoUrl: solution.videoUrl ?? "",
      isPremium: solution.isPremium,
      note: "",
    })
  }, [solution])

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/content/solutions/${params.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          content: form.content,
          templateType: form.templateType || undefined,
          visibility: form.visibility,
          accessLevel: form.accessLevel || undefined,
          videoUrl: form.videoUrl || undefined,
          isPremium: form.isPremium,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "题解保存失败")
      }
      await mutate()
      toast.success("题解内容已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "题解保存失败")
    } finally {
      setSaving(false)
    }
  }

  const transition = async (toStatus: CmsStatus) => {
    setTransitioning(true)
    try {
      const payload: CmsStatusTransitionInput = {
        resourceType: "solution",
        resourceId: params.id,
        toStatus,
        note: form.note || undefined,
      }
      const response = await fetch("/api/admin/content/workflow", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result?.message || "状态流转失败")
      }
      setForm((current) => ({ ...current, note: "" }))
      await mutate()
      toast.success(`题解已切换为 ${toStatus}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态流转失败")
    } finally {
      setTransitioning(false)
    }
  }

  const applyTemplate = (templateType: string) => {
    const template = SOLUTION_TEMPLATE_OPTIONS.find((item) => item.type === templateType)
    if (!template) return
    setForm((current) => ({
      ...current,
      templateType,
      content: current.content.trim() ? `${template.content}\n\n${current.content}` : template.content,
    }))
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">题解详情加载失败。</div>
  }

  if (!solution) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">题解详情加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{solution.problem.title}</Badge>
            <Badge variant="outline">{solution.status}</Badge>
            <Badge variant="outline">{solution.visibility}</Badge>
            {solution.accessLevel ? <Badge variant="outline">{solution.accessLevel}</Badge> : null}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">题解模板化编辑</h1>
          <p className="text-muted-foreground">保留草稿和审核状态，发布后前台才会读取完整题解内容。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/content/solutions">返回题解列表</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/problems/${solution.problem.slug}`}>前台预览</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <textarea
              className="min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="摘要"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Input value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))} placeholder="visibility" />
              <Input value={form.accessLevel} onChange={(event) => setForm((current) => ({ ...current, accessLevel: event.target.value }))} placeholder="accessLevel" />
              <Input value={form.videoUrl} onChange={(event) => setForm((current) => ({ ...current, videoUrl: event.target.value }))} placeholder="videoUrl" />
            </div>

            <div className="flex flex-wrap gap-2">
              {SOLUTION_TEMPLATE_OPTIONS.map((template) => (
                <Button
                  key={template.type}
                  type="button"
                  variant={form.templateType === template.type ? "default" : "secondary"}
                  onClick={() => applyTemplate(template.type)}
                >
                  {template.label}
                </Button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.isPremium}
                onChange={(event) => setForm((current) => ({ ...current, isPremium: event.target.checked }))}
              />
              作为高级题解处理
            </label>

            <textarea
              className="min-h-[420px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="题解正文"
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? "保存中..." : "保存题解"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">内容状态流转</h2>
              <Input
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="审核备注（可选）"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={transitioning} onClick={() => transition("draft")}>
                  退回草稿
                </Button>
                <Button variant="secondary" disabled={transitioning} onClick={() => transition("review")}>
                  提交审核
                </Button>
                <Button disabled={transitioning} onClick={() => transition("published")}>
                  发布上线
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">关联商品</h2>
              {solution.linkedProducts.length ? (
                solution.linkedProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-border/70 bg-card px-4 py-4">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatPriceCents(product.defaultSku.priceCents, product.defaultSku.currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">当前还没有直接绑定商品。</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-foreground">审核日志</h2>
              {solution.workflowLogs.length ? (
                solution.workflowLogs.map((log) => (
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
