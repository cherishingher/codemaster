"use client"

import Link from "next/link"
import useSWR from "swr"
import type { TenantOrganizationsResponse } from "@/lib/tenant-admin"
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

export default function TenantHomePage() {
  const { data, error } = useSWR<TenantOrganizationsResponse>("/api/tenant/organizations", fetcher)

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">租户工作台加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">租户工作台加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">租户工作台</h1>
        <p className="mt-2 text-muted-foreground">学校 / 机构按组织维度进行逻辑隔离，管理员和教师只看到自己租户的数据。</p>
      </div>
      {data.data.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">当前账号还没有可访问的学校 / 机构。</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.data.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{item.role}</Badge>
                    <Badge variant="outline">{item.type}</Badge>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <div className="text-lg font-semibold text-foreground">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    slug: {item.slug} · 成员 {item.memberCount} · 班级 {item.classCount}
                  </div>
                </div>
                <Button asChild>
                  <Link href={`/tenant/organizations/${item.id}`}>进入机构</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
