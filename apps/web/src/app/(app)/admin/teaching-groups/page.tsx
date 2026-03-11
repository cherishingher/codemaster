"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import type { OrganizationsResponse, TeachingGroupsResponse } from "@/lib/edu-admin"
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

export default function AdminTeachingGroupsPage() {
  const { data: groupsResponse, error: groupsError, mutate } = useSWR<TeachingGroupsResponse>(
    "/api/admin/teaching-groups",
    fetcher,
  )
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>("/api/admin/organizations", fetcher)
  const [form, setForm] = React.useState({
    organizationId: "",
    ownerIdentifier: "",
    slug: "",
    name: "",
    code: "",
    groupType: "class",
    status: "draft",
    summary: "",
    startAt: "",
    endAt: "",
  })
  const [submitting, setSubmitting] = React.useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/teaching-groups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizationId: form.organizationId || undefined,
          slug: form.slug || undefined,
          code: form.code || undefined,
          summary: form.summary || undefined,
          startAt: form.startAt || undefined,
          endAt: form.endAt || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "教学组创建失败")
      }
      setForm({
        organizationId: "",
        ownerIdentifier: "",
        slug: "",
        name: "",
        code: "",
        groupType: "class",
        status: "draft",
        summary: "",
        startAt: "",
        endAt: "",
      })
      await mutate()
      toast.success("教学组已创建")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "教学组创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (groupsError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教学组后台加载失败。</div>
  }

  if (!groupsResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教学组后台加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">班级后台</h1>
          <p className="mt-2 text-muted-foreground">先做班级 / 教学组的基础模型、成员导入和题单布置，为三期教师 / 机构版预埋分组能力。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">返回工具页</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">创建教学组</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.organizationId}
              onChange={(e) => setForm((current) => ({ ...current, organizationId: e.target.value }))}
            >
              <option value="">不挂机构</option>
              {(organizationsResponse?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="负责人用户 ID / 邮箱 / 手机号"
              value={form.ownerIdentifier}
              onChange={(e) => setForm((current) => ({ ...current, ownerIdentifier: e.target.value }))}
            />
            <Input placeholder="slug（可选）" value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} />
            <Input placeholder="教学组名称" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            <Input placeholder="编码（可选）" value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} />
            <Input placeholder="类型 class/camp/prep" value={form.groupType} onChange={(e) => setForm((current) => ({ ...current, groupType: e.target.value }))} />
            <Input placeholder="状态 draft/active" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} />
            <Input placeholder="开始时间 ISO（可选）" value={form.startAt} onChange={(e) => setForm((current) => ({ ...current, startAt: e.target.value }))} />
            <Input placeholder="结束时间 ISO（可选）" value={form.endAt} onChange={(e) => setForm((current) => ({ ...current, endAt: e.target.value }))} />
          </div>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="教学组简介（可选）"
            value={form.summary}
            onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))}
          />
          <Button onClick={submit} disabled={submitting || !form.name.trim() || !form.ownerIdentifier.trim()}>
            {submitting ? "创建中..." : "创建教学组"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {groupsResponse.data.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.groupType}</Badge>
                  <Badge variant="outline">{item.status}</Badge>
                  {item.organization ? <Badge variant="outline">{item.organization.name}</Badge> : null}
                </div>
                <div className="text-lg font-semibold text-foreground">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  slug: {item.slug} · 成员 {item.memberCount} · 负责人 {item.owner.name || item.owner.email || item.owner.id}
                </div>
                {item.summary ? <div className="text-sm text-muted-foreground">{item.summary}</div> : null}
              </div>
              <Button asChild>
                <Link href={`/admin/teaching-groups/${item.id}`}>进入班级</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
