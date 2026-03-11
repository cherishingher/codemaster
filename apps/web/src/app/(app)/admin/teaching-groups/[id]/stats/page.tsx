"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import type {
  TeachingGroupDetailResponse,
  TeachingGroupStatsResponse,
} from "@/lib/edu-admin"
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

export default function AdminTeachingGroupStatsPage() {
  const params = useParams<{ id: string }>()
  const groupId = typeof params?.id === "string" ? params.id : ""
  const { data: detailResponse, error: detailError } = useSWR<TeachingGroupDetailResponse>(
    groupId ? `/api/admin/teaching-groups/${groupId}` : null,
    fetcher,
  )
  const { data: statsResponse, error: statsError } = useSWR<TeachingGroupStatsResponse>(
    groupId ? `/api/admin/teaching-groups/${groupId}/stats` : null,
    fetcher,
  )

  if (detailError || statsError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级统计加载失败。</div>
  }

  if (!detailResponse || !statsResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级统计加载中...</div>
  }

  const group = detailResponse.data
  const stats = statsResponse.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{group.groupType}</Badge>
            <Badge variant="outline">{group.status}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{group.name} · 班级统计</h1>
          <p className="mt-2 text-muted-foreground">基于班级成员、已布置题单、提交记录和做题进度做的基础聚合。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/teaching-groups/${group.id}`}>返回班级详情</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">学生数</div><div className="mt-2 text-3xl font-bold">{stats.summary.studentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">已布置题单</div><div className="mt-2 text-3xl font-bold">{stats.summary.assignmentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">已分配题目</div><div className="mt-2 text-3xl font-bold">{stats.summary.assignedProblemCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">平均完成度</div><div className="mt-2 text-3xl font-bold">{stats.summary.avgCompletionRate}%</div></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">活跃学生</div><div className="mt-2 text-2xl font-semibold">{stats.summary.activeStudentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">总提交数</div><div className="mt-2 text-2xl font-semibold">{stats.summary.totalSubmissions}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">累计解题人次</div><div className="mt-2 text-2xl font-semibold">{stats.summary.solvedStudentProblemCount}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">题单完成概览</h2>
          {stats.assignments.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前班级还没有布置题单。</div>
          ) : (
            <div className="space-y-3">
              {stats.assignments.map((assignment) => (
                <div key={assignment.assignmentId} className="rounded-lg border border-border p-4">
                  <div className="font-medium text-foreground">{assignment.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {assignment.problemCount} 题
                    {assignment.dueAt ? ` · 截止 ${assignment.dueAt}` : ""}
                    {` · 已开始 ${assignment.startedStudentCount} 人 · 已完成 ${assignment.completedStudentCount} 人 · 平均完成度 ${assignment.avgCompletionRate}%`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">成员表现</h2>
          {stats.members.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前班级还没有学生成员。</div>
          ) : (
            <div className="space-y-3">
              {stats.members.map((member) => (
                <div key={member.userId} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <div className="font-medium text-foreground">{member.name || member.email || member.phone || member.userId}</div>
                    <div className="text-sm text-muted-foreground">
                      尝试 {member.attemptedProblemCount} 题 · 通过 {member.solvedProblemCount} 题 · 提交 {member.submissionCount} 次 · 完成度 {member.completionRate}%
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{member.lastActiveAt ? `最近活跃 ${member.lastActiveAt}` : "暂无活跃记录"}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
