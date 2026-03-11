"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type {
  TenantAssignmentItem,
  TenantAssignmentsResponse,
  TenantClassDetailResponse,
  TenantClassStatsResponse,
} from "@/lib/tenant-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AssignableProblemSet = {
  id: string
  title: string
  count: number
}

async function fetcher<T>(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "加载失败")
  }
  return payload as T
}

export default function TenantClassPage() {
  const params = useParams<{ id: string; classId: string }>()
  const orgId = typeof params?.id === "string" ? params.id : ""
  const classId = typeof params?.classId === "string" ? params.classId : ""
  const classUrl = orgId && classId ? `/api/tenant/organizations/${orgId}/classes/${classId}` : null
  const assignmentsUrl = orgId && classId ? `/api/tenant/organizations/${orgId}/classes/${classId}/assignments` : null

  const { data: classResponse, error: classError } = useSWR<TenantClassDetailResponse>(classUrl, fetcher)
  const { data: statsResponse, error: statsError } = useSWR<TenantClassStatsResponse>(
    orgId && classId ? `/api/tenant/organizations/${orgId}/classes/${classId}/stats` : null,
    fetcher,
  )
  const { data: assignmentsResponse, mutate: mutateAssignments } = useSWR<TenantAssignmentsResponse>(
    assignmentsUrl,
    fetcher,
  )
  const { data: problemSetsResponse } = useSWR<AssignableProblemSet[]>("/api/problem-sets", fetcher)

  const [assignmentForm, setAssignmentForm] = React.useState({
    problemSetId: "",
    title: "",
    note: "",
    dueAt: "",
    maxScore: "100",
  })

  const submitAssignment = async () => {
    if (!assignmentsUrl) return
    const response = await fetch(assignmentsUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemSetId: assignmentForm.problemSetId,
        title: assignmentForm.title || undefined,
        note: assignmentForm.note || undefined,
        dueAt: assignmentForm.dueAt ? new Date(assignmentForm.dueAt).toISOString() : undefined,
        maxScore: Number(assignmentForm.maxScore || 100),
        publishNow: true,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "布置作业失败")
    toast.success("作业已创建并发布")
    setAssignmentForm({ problemSetId: "", title: "", note: "", dueAt: "", maxScore: "100" })
    await mutateAssignments()
  }

  if (classError || statsError) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级详情加载失败。</div>
  }

  if (!classResponse || !statsResponse || !assignmentsResponse) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">班级详情加载中...</div>
  }

  const item = classResponse.data
  const stats = statsResponse.data
  const assignments = assignmentsResponse.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex gap-2">
            <Badge variant="secondary">{item.status}</Badge>
            <Badge variant="outline">{item.groupType}</Badge>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{item.name}</h1>
          <p className="mt-2 text-muted-foreground">{item.organization.name} · 成员 {item.memberCount}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href={`/tenant/organizations/${orgId}`}>返回机构</Link>
          </Button>
          <Button asChild>
            <Link href={`/tenant/organizations/${orgId}/classes/${classId}/stats`}>查看班级统计</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">学生数</div><div className="mt-2 text-3xl font-bold">{stats.summary.studentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">已布置作业</div><div className="mt-2 text-3xl font-bold">{assignments.length}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">总提交</div><div className="mt-2 text-3xl font-bold">{stats.summary.totalSubmissions}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">平均完成度</div><div className="mt-2 text-3xl font-bold">{stats.summary.avgCompletionRate}%</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">布置题单作业</h2>
              <p className="mt-1 text-sm text-muted-foreground">复用现有题单作为班级作业，系统会自动同步完成度和成绩。</p>
            </div>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={assignmentForm.problemSetId}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, problemSetId: e.target.value }))}
            >
              <option value="">选择题单</option>
              {(problemSetsResponse ?? []).map((set) => (
                <option key={set.id} value={set.id}>
                  {set.title} · {set.count} 题
                </option>
              ))}
            </select>
            <Input
              placeholder="作业标题（可选）"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, title: e.target.value }))}
            />
            <Input
              placeholder="截止时间（本地时间）"
              type="datetime-local"
              value={assignmentForm.dueAt}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, dueAt: e.target.value }))}
            />
            <Input
              placeholder="满分"
              type="number"
              min={1}
              max={1000}
              value={assignmentForm.maxScore}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, maxScore: e.target.value }))}
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="作业说明（可选）"
              value={assignmentForm.note}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, note: e.target.value }))}
            />
            <Button
              onClick={() => submitAssignment().catch((error: Error) => toast.error(error.message))}
              disabled={!assignmentForm.problemSetId}
            >
              创建作业
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">班级成员</h2>
                <p className="mt-1 text-sm text-muted-foreground">教师可在机构工作台创建学生并加入当前班级。</p>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/tenant/organizations/${orgId}`}>去管理机构成员</Link>
              </Button>
            </div>
            {item.members.length === 0 ? (
              <div className="text-sm text-muted-foreground">班级还没有成员。</div>
            ) : (
              <div className="space-y-3">
                {item.members.map((member) => (
                  <div key={member.userId} className="rounded-lg border border-border p-4">
                    <div className="font-medium text-foreground">{member.user.name || member.user.email || member.user.phone || member.userId}</div>
                    <div className="text-sm text-muted-foreground">{member.memberRole} · {member.status}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">作业与成绩</h2>
              <p className="mt-1 text-sm text-muted-foreground">点击进入成绩簿，可同步完成度并录入人工评分与反馈。</p>
            </div>
          </div>
          {assignments.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前班级还没有作业。</div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment: TenantAssignmentItem) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{assignment.title}</div>
                      <Badge variant="outline">{assignment.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.problemSet.title} · {assignment.problemSet.itemCount} 题 · 满分 {assignment.maxScore}
                      {assignment.dueAt ? ` · 截止 ${new Date(assignment.dueAt).toLocaleString()}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      已评分 {assignment.gradeSummary.gradedCount}/{assignment.gradeSummary.studentCount} · 平均分 {assignment.gradeSummary.avgScore}
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/tenant/organizations/${orgId}/classes/${classId}/assignments/${assignment.id}`}>成绩簿</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">班级基础成绩概览</h2>
          {stats.members.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无学生成绩数据。</div>
          ) : (
            <div className="space-y-3">
              {stats.members.map((member) => (
                <div key={member.userId} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <div className="font-medium text-foreground">{member.name || member.email || member.phone || member.userId}</div>
                    <div className="text-sm text-muted-foreground">
                      尝试 {member.attemptedProblemCount} · 通过 {member.solvedProblemCount} · 提交 {member.submissionCount}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-foreground">{member.completionRate}%</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
