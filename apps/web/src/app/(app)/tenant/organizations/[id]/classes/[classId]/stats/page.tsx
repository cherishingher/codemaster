"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import type { TenantClassStatsResponse } from "@/lib/tenant-admin"
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

export default function TenantClassStatsPage() {
  const params = useParams<{ id: string; classId: string }>()
  const orgId = typeof params?.id === "string" ? params.id : ""
  const classId = typeof params?.classId === "string" ? params.classId : ""
  const { data, error } = useSWR<TenantClassStatsResponse>(
    orgId && classId ? `/api/tenant/organizations/${orgId}/classes/${classId}/stats` : null,
    fetcher,
  )

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级统计加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级统计加载中...</div>
  }

  const stats = data.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">班级统计</h1>
          <p className="mt-2 text-muted-foreground">基于当前班级作业、提交和做题记录的聚合结果。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/tenant/organizations/${orgId}/classes/${classId}`}>返回班级</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">学生数</div><div className="mt-2 text-3xl font-bold">{stats.summary.studentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">活跃学生</div><div className="mt-2 text-3xl font-bold">{stats.summary.activeStudentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">总提交</div><div className="mt-2 text-3xl font-bold">{stats.summary.totalSubmissions}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">平均完成度</div><div className="mt-2 text-3xl font-bold">{stats.summary.avgCompletionRate}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">作业完成概览</h2>
          {stats.assignments.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前班级还没有作业。</div>
          ) : (
            <div className="space-y-3">
              {stats.assignments.map((assignment) => (
                <div key={assignment.assignmentId} className="rounded-lg border border-border p-4">
                  <div className="font-medium text-foreground">{assignment.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {assignment.problemCount} 题 · 开始 {assignment.startedStudentCount} 人 · 完成 {assignment.completedStudentCount} 人 · 平均完成度 {assignment.avgCompletionRate}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
