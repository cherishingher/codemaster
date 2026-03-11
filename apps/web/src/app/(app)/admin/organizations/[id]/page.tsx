"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import type { OrganizationDetailResponse } from "@/lib/edu-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

async function fetcher<T>(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "加载失败")
  }
  return payload as T
}

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>()
  const orgId = typeof params?.id === "string" ? params.id : ""
  const { data, error } = useSWR<OrganizationDetailResponse>(
    orgId ? `/api/admin/organizations/${orgId}` : null,
    fetcher,
  )

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">机构详情加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">机构详情加载中...</div>
  }

  const item = data.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{item.type}</Badge>
            <Badge variant="outline">{item.status}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{item.name}</h1>
          <p className="mt-2 text-muted-foreground">
            slug: {item.slug} · 成员 {item.memberCount} · 教师 {item.teacherCount} · 班级 {item.groupCount}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/organizations">返回机构列表</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">联系人</div>
            <div className="mt-1 font-medium">{item.contactName || "未设置"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">联系邮箱</div>
            <div className="mt-1 font-medium">{item.contactEmail || "未设置"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">联系电话</div>
            <div className="mt-1 font-medium">{item.contactPhone || "未设置"}</div>
          </div>
          <div className="md:col-span-3">
            <div className="text-sm text-muted-foreground">机构说明</div>
            <div className="mt-1 text-sm text-foreground">{item.description || "暂无机构说明"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">教师列表</h2>
          {item.teachers.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前机构还没有挂载教师资料。</div>
          ) : (
            <div className="space-y-3">
              {item.teachers.map((teacher) => (
                <div key={teacher.userId} className="rounded-lg border border-border p-4">
                  <div className="font-medium text-foreground">
                    {teacher.displayName || teacher.user.name || teacher.user.email || teacher.userId}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {teacher.title || "未设置头衔"} · {(teacher.specialties ?? []).join(" / ") || "未设置擅长方向"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">班级列表</h2>
          {item.groups.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前机构还没有班级 / 教学组。</div>
          ) : (
            <div className="space-y-3">
              {item.groups.map((group) => (
                <div key={group.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <div className="font-medium text-foreground">{group.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {group.groupType} · 成员 {group.memberCount} · 负责人 {group.owner.name || group.owner.email || group.owner.id}
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/admin/teaching-groups/${group.id}`}>查看班级</Link>
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
