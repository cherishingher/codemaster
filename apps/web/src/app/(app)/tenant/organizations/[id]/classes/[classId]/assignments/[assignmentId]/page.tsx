"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type { TenantAssignmentDetailResponse } from "@/lib/tenant-admin"
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

export default function TenantAssignmentPage() {
  const params = useParams<{ id: string; classId: string; assignmentId: string }>()
  const orgId = typeof params?.id === "string" ? params.id : ""
  const classId = typeof params?.classId === "string" ? params.classId : ""
  const assignmentId = typeof params?.assignmentId === "string" ? params.assignmentId : ""
  const detailUrl =
    orgId && classId && assignmentId
      ? `/api/tenant/organizations/${orgId}/classes/${classId}/assignments/${assignmentId}`
      : null

  const { data, error, mutate } = useSWR<TenantAssignmentDetailResponse>(detailUrl, fetcher)
  const [drafts, setDrafts] = React.useState<Record<string, { manualScore: string; feedback: string }>>({})

  React.useEffect(() => {
    if (!data) return
    setDrafts(
      Object.fromEntries(
        data.data.grades.map((grade) => [
          grade.userId,
          {
            manualScore: grade.manualScore?.toString() ?? "",
            feedback: grade.feedback ?? "",
          },
        ]),
      ),
    )
  }, [data])

  const syncGrades = async () => {
    const response = await fetch(`${detailUrl}/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "同步成绩失败")
    await mutate()
    toast.success("作业成绩已同步")
  }

  const saveGrade = async (studentId: string) => {
    const draft = drafts[studentId] ?? { manualScore: "", feedback: "" }
    const response = await fetch(`${detailUrl}/grades/${studentId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manualScore: draft.manualScore === "" ? null : Number(draft.manualScore),
        feedback: draft.feedback || undefined,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.message || "保存成绩失败")
    await mutate()
    toast.success("成绩已保存")
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">作业成绩簿加载失败。</div>
  }

  if (!data) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">作业成绩簿加载中...</div>
  }

  const assignment = data.data

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Badge variant="secondary">{assignment.status}</Badge>
            <Badge variant="outline">{assignment.gradingMode}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
          <p className="text-muted-foreground">
            {assignment.classInfo.name} · {assignment.problemSet.title} · {assignment.problemSet.itemCount} 题 · 满分 {assignment.maxScore}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href={`/tenant/organizations/${orgId}/classes/${classId}`}>返回班级</Link>
          </Button>
          <Button onClick={() => syncGrades().catch((err: Error) => toast.error(err.message))}>同步成绩</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">学生数</div><div className="mt-2 text-3xl font-bold">{assignment.stats.studentCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">已评分</div><div className="mt-2 text-3xl font-bold">{assignment.stats.gradedCount}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">平均分</div><div className="mt-2 text-3xl font-bold">{assignment.stats.avgScore}</div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="text-sm text-muted-foreground">平均完成度</div><div className="mt-2 text-3xl font-bold">{assignment.stats.avgCompletionRate}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">学生成绩簿</h2>
          {assignment.grades.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前作业还没有学生成绩数据。</div>
          ) : (
            <div className="space-y-4">
              {assignment.grades.map((grade) => {
                const draft = drafts[grade.userId] ?? { manualScore: "", feedback: "" }
                return (
                  <div key={grade.userId} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-foreground">{grade.name || grade.email || grade.phone || grade.userId}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          状态 {grade.status} · 自动分 {grade.autoScore}/{grade.maxScore} · 最终分 {grade.finalScore}/{grade.maxScore}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          完成度 {grade.completionRate}% · 通过 {grade.solvedProblemCount} · 尝试 {grade.attemptedProblemCount} · 提交 {grade.submissionCount}
                          {grade.lastSubmissionAt ? ` · 最近提交 ${new Date(grade.lastSubmissionAt).toLocaleString()}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline">{grade.status}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                      <Input
                        type="number"
                        min={0}
                        max={grade.maxScore}
                        placeholder="人工分数"
                        value={draft.manualScore}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [grade.userId]: {
                              ...draft,
                              manualScore: e.target.value,
                            },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="教师评语（可选）"
                        value={draft.feedback}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [grade.userId]: {
                              ...draft,
                              feedback: e.target.value,
                            },
                          }))
                        }
                      />
                      <Button onClick={() => saveGrade(grade.userId).catch((err: Error) => toast.error(err.message))}>
                        保存
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
