"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import type { OrganizationsResponse, TeacherProfilesResponse } from "@/lib/edu-admin"
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

export default function AdminTeachersPage() {
  const { data: teachersResponse, error: teachersError, mutate } = useSWR<TeacherProfilesResponse>(
    "/api/admin/teachers",
    fetcher,
  )
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>("/api/admin/organizations", fetcher)
  const [form, setForm] = React.useState({
    userIdentifier: "",
    organizationId: "",
    displayName: "",
    title: "",
    specialties: "",
    status: "draft",
  })
  const [submitting, setSubmitting] = React.useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/teachers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          organizationId: form.organizationId || undefined,
          specialties: form.specialties
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "教师资料保存失败")
      }
      setForm({
        userIdentifier: "",
        organizationId: "",
        displayName: "",
        title: "",
        specialties: "",
        status: "draft",
      })
      await mutate()
      toast.success("教师资料已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "教师资料保存失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (teachersError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教师后台加载失败。</div>
  }

  if (!teachersResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教师后台加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">教师资料后台</h1>
          <p className="mt-2 text-muted-foreground">先挂靠教师资料与所属机构，为后续教师 / 机构版做基础身份层。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin">返回工具页</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">录入教师资料</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="用户 ID / 邮箱 / 手机号" value={form.userIdentifier} onChange={(e) => setForm((current) => ({ ...current, userIdentifier: e.target.value }))} />
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
            <Input placeholder="展示名" value={form.displayName} onChange={(e) => setForm((current) => ({ ...current, displayName: e.target.value }))} />
            <Input placeholder="头衔" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
            <Input placeholder="擅长方向，逗号分隔" value={form.specialties} onChange={(e) => setForm((current) => ({ ...current, specialties: e.target.value }))} />
            <Input placeholder="状态 draft/active" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))} />
          </div>
          <Button onClick={submit} disabled={submitting || !form.userIdentifier.trim()}>
            {submitting ? "保存中..." : "保存教师资料"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {teachersResponse.data.map((item) => (
          <Card key={item.userId}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.status}</Badge>
                  {item.organization ? <Badge variant="outline">{item.organization.name}</Badge> : null}
                </div>
                <div className="text-lg font-semibold text-foreground">{item.displayName || item.user.name || item.user.email || item.userId}</div>
                <div className="text-sm text-muted-foreground">
                  {item.title || "未设置头衔"} · {(item.specialties ?? []).join(" / ") || "未设置擅长方向"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
