"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type {
  TenantApiKeysResponse,
  TenantClassesResponse,
} from "@/lib/tenant-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type TenantOrganizationDetailResponse = {
  data: {
    id: string
    name: string
    slug: string
    role: string
    memberCount: number
    classCount: number
    apiKeys: TenantApiKeysResponse["data"]
  }
}

async function fetcher<T>(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "加载失败")
  }
  return payload as T
}

export default function TenantOrganizationPage() {
  const params = useParams<{ id: string }>()
  const orgId = typeof params?.id === "string" ? params.id : ""
  const { data: orgResponse, error: orgError, mutate: mutateOrg } = useSWR<TenantOrganizationDetailResponse>(
    orgId ? `/api/tenant/organizations/${orgId}` : null,
    fetcher,
  )
  const { data: classesResponse, mutate: mutateClasses } = useSWR<TenantClassesResponse>(
    orgId ? `/api/tenant/organizations/${orgId}/classes` : null,
    fetcher,
  )
  const [teacherForm, setTeacherForm] = React.useState({ name: "", email: "", phone: "", title: "" })
  const [studentForm, setStudentForm] = React.useState({ name: "", email: "", phone: "", classId: "" })
  const [classForm, setClassForm] = React.useState({ name: "", code: "", externalCode: "" })
  const [apiKeyForm, setApiKeyForm] = React.useState({ name: "SIS 集成 Key", expiresAt: "" })

  const submitTeacher = async () => {
    const response = await fetch(`/api/tenant/organizations/${orgId}/teachers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teacherForm),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "创建教师失败")
    toast.success("教师已创建")
    setTeacherForm({ name: "", email: "", phone: "", title: "" })
    await mutateOrg()
  }

  const submitStudent = async () => {
    const response = await fetch(`/api/tenant/organizations/${orgId}/students`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...studentForm,
        classId: studentForm.classId || undefined,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "创建学生失败")
    toast.success("学生已创建")
    setStudentForm({ name: "", email: "", phone: "", classId: "" })
  }

  const submitClass = async () => {
    const response = await fetch(`/api/tenant/organizations/${orgId}/classes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classForm),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "创建班级失败")
    toast.success("班级已创建")
    setClassForm({ name: "", code: "", externalCode: "" })
    await mutateClasses()
    await mutateOrg()
  }

  const submitApiKey = async () => {
    const response = await fetch(`/api/tenant/organizations/${orgId}/api-keys`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...apiKeyForm,
        expiresAt: apiKeyForm.expiresAt || undefined,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "创建 API Key 失败")
    toast.success(`API Key 已创建，请立即保存：${payload?.data?.rawToken ?? ""}`)
    await mutateOrg()
  }

  if (orgError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">租户详情加载失败。</div>
  }

  if (!orgResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">租户详情加载中...</div>
  }

  const org = orgResponse.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex gap-2">
            <Badge variant="secondary">{org.role}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{org.name}</h1>
          <p className="mt-2 text-muted-foreground">slug: {org.slug} · 成员 {org.memberCount} · 班级 {org.classCount}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/tenant">返回机构列表</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">创建教师</h2>
            <Input placeholder="姓名" value={teacherForm.name} onChange={(e) => setTeacherForm((c) => ({ ...c, name: e.target.value }))} />
            <Input placeholder="邮箱" value={teacherForm.email} onChange={(e) => setTeacherForm((c) => ({ ...c, email: e.target.value }))} />
            <Input placeholder="手机号" value={teacherForm.phone} onChange={(e) => setTeacherForm((c) => ({ ...c, phone: e.target.value }))} />
            <Input placeholder="头衔" value={teacherForm.title} onChange={(e) => setTeacherForm((c) => ({ ...c, title: e.target.value }))} />
            <Button onClick={() => submitTeacher().catch((err) => toast.error(err.message))}>创建教师</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">创建学生</h2>
            <Input placeholder="姓名" value={studentForm.name} onChange={(e) => setStudentForm((c) => ({ ...c, name: e.target.value }))} />
            <Input placeholder="邮箱" value={studentForm.email} onChange={(e) => setStudentForm((c) => ({ ...c, email: e.target.value }))} />
            <Input placeholder="手机号" value={studentForm.phone} onChange={(e) => setStudentForm((c) => ({ ...c, phone: e.target.value }))} />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={studentForm.classId}
              onChange={(e) => setStudentForm((c) => ({ ...c, classId: e.target.value }))}
            >
              <option value="">暂不加入班级</option>
              {(classesResponse?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button onClick={() => submitStudent().catch((err) => toast.error(err.message))}>创建学生</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">创建班级</h2>
            <Input placeholder="班级名称" value={classForm.name} onChange={(e) => setClassForm((c) => ({ ...c, name: e.target.value }))} />
            <Input placeholder="班级编码" value={classForm.code} onChange={(e) => setClassForm((c) => ({ ...c, code: e.target.value }))} />
            <Input placeholder="外部编码" value={classForm.externalCode} onChange={(e) => setClassForm((c) => ({ ...c, externalCode: e.target.value }))} />
            <Button onClick={() => submitClass().catch((err) => toast.error(err.message))}>创建班级</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">开放 API Key</h2>
            <Input placeholder="Key 名称" value={apiKeyForm.name} onChange={(e) => setApiKeyForm((c) => ({ ...c, name: e.target.value }))} />
            <Input placeholder="过期时间 ISO（可选）" value={apiKeyForm.expiresAt} onChange={(e) => setApiKeyForm((c) => ({ ...c, expiresAt: e.target.value }))} />
            <Button onClick={() => submitApiKey().catch((err) => toast.error(err.message))}>创建 API Key</Button>
            <div className="space-y-2 text-sm text-muted-foreground">
              {org.apiKeys.map((item) => (
                <div key={item.id}>
                  {item.name} · {item.status}
                  {item.lastUsedAt ? ` · 最近使用 ${item.lastUsedAt}` : ""}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">班级列表</h2>
          {(classesResponse?.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">当前租户还没有班级。</div>
          ) : (
            <div className="space-y-3">
              {(classesResponse?.data ?? []).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.code || item.slug} · 成员 {item.memberCount} · 负责人 {item.owner.name || item.owner.email || item.owner.id}
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/tenant/organizations/${orgId}/classes/${item.id}`}>查看班级</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
