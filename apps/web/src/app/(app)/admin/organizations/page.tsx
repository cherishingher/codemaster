"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import type { OrganizationsResponse } from "@/lib/edu-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "机构列表加载失败")
  }
  return payload as OrganizationsResponse
}

export default function AdminOrganizationsPage() {
  const { data, error, mutate } = useSWR("/api/admin/organizations", fetcher)
  const [form, setForm] = React.useState({
    slug: "",
    name: "",
    shortName: "",
    externalCode: "",
    type: "institution",
    status: "draft",
    contactName: "",
    adminIdentifier: "",
    adminName: "",
  })
  const [submitting, setSubmitting] = React.useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch("/api/tenant/organizations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "机构创建失败")
      }
      setForm({
        slug: "",
        name: "",
        shortName: "",
        externalCode: "",
        type: "institution",
        status: "draft",
        contactName: "",
        adminIdentifier: "",
        adminName: "",
      })
      await mutate()
      toast.success("机构已创建")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "机构创建失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">机构后台加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">机构后台加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">机构后台</h1>
          <p className="mt-2 text-muted-foreground">平台管理员创建租户机构，并在创建时绑定首个机构管理员。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">返回工具页</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">创建机构</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="slug（可选）" value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} />
            <Input placeholder="机构名称" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            <Input placeholder="简称" value={form.shortName} onChange={(e) => setForm((current) => ({ ...current, shortName: e.target.value }))} />
            <Input placeholder="外部编码（可选）" value={form.externalCode} onChange={(e) => setForm((current) => ({ ...current, externalCode: e.target.value }))} />
            <Input placeholder="类型 institution/school" value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} />
            <Input placeholder="状态 draft/active" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} />
            <Input placeholder="联系人" value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} />
            <Input placeholder="机构管理员邮箱/手机号" value={form.adminIdentifier} onChange={(e) => setForm((current) => ({ ...current, adminIdentifier: e.target.value }))} />
            <Input placeholder="机构管理员姓名（可选）" value={form.adminName} onChange={(e) => setForm((current) => ({ ...current, adminName: e.target.value }))} />
          </div>
          <Button onClick={submit} disabled={submitting || !form.name.trim() || !form.adminIdentifier.trim()}>
            {submitting ? "创建中..." : "创建机构"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.data.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.type}</Badge>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="text-lg font-semibold text-foreground">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  slug: {item.slug} · 成员 {item.memberCount} · 教师 {item.teacherCount} · 班级 {item.groupCount}
                </div>
              </div>
              <Button asChild>
                <Link href={`/admin/organizations/${item.id}`}>查看详情</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
