"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { client } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { GraduationCap, BookOpen, BarChart3, Plus, Calendar, Download } from "lucide-react"

type Assignment = { id: string; title: string; dueAt: string | null; problemSet: { id: string; title: string; count: number } }
type StudentStat = { userId: string; name: string | null; email: string | null; solved: number; totalProblems: number; completionRate: number }
type StatsData = { classroomName: string; memberCount: number; assignmentCount: number; students: StudentStat[] }

export default function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [tab, setTab] = useState<"assignments" | "stats">("assignments")

  const { data: assignments, mutate } = useSWR(id ? ["class-assignments", id] : null,
    () => client<Assignment[]>(`/classrooms/${id}/assignments`).catch(() => []))
  const { data: stats } = useSWR(id && tab === "stats" ? ["class-stats", id] : null,
    () => client<StatsData>(`/classrooms/${id}/stats`).catch(() => null))

  const [showAdd, setShowAdd] = useState(false)
  const [aTitle, setATitle] = useState("")
  const [aPsId, setAPsId] = useState("")
  const [aDue, setADue] = useState("")

  async function handleAddAssignment() {
    try {
      await client(`/classrooms/${id}/assignments`, {
        method: "POST",
        body: JSON.stringify({ title: aTitle, problemSetId: aPsId, dueAt: aDue ? new Date(aDue).toISOString() : undefined }),
      })
      toast.success("作业已布置")
      setShowAdd(false); setATitle(""); setAPsId(""); setADue(""); mutate()
    } catch (e: any) { toast.error(e.message || "操作失败") }
  }

  function exportCsv() {
    if (!stats) return
    const header = "姓名,邮箱,已完成,总题数,完成率"
    const rows = stats.students.map((s) => `${s.name ?? ""},${s.email ?? ""},${s.solved},${s.totalProblems},${s.completionRate}%`)
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "成绩.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
        <GraduationCap className="h-6 w-6" /> {stats?.classroomName ?? "班级详情"}
      </h1>
      {stats && <p className="text-sm text-muted-foreground mb-6">{stats.memberCount} 名学生 · {stats.assignmentCount} 个作业</p>}

      <div className="flex gap-2 mb-6 border-b">
        {(["assignments", "stats"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            {t === "assignments" ? <><BookOpen className="inline h-4 w-4 mr-1" />作业</> : <><BarChart3 className="inline h-4 w-4 mr-1" />成绩</>}
          </button>
        ))}
      </div>

      {tab === "assignments" && (
        <>
          <Button size="sm" className="mb-4" onClick={() => setShowAdd(!showAdd)}><Plus className="h-4 w-4 mr-1" /> 布置作业</Button>
          {showAdd && (
            <Card className="mb-4"><CardContent className="p-4 space-y-2">
              <input className="w-full border rounded px-3 py-2 text-sm" placeholder="作业标题" value={aTitle} onChange={(e) => setATitle(e.target.value)} />
              <input className="w-full border rounded px-3 py-2 text-sm" placeholder="题单 ID" value={aPsId} onChange={(e) => setAPsId(e.target.value)} />
              <input type="datetime-local" className="border rounded px-3 py-2 text-sm" value={aDue} onChange={(e) => setADue(e.target.value)} />
              <Button onClick={handleAddAssignment}>布置</Button>
            </CardContent></Card>
          )}
          <div className="space-y-2">
            {assignments?.map((a) => (
              <Card key={a.id}><CardContent className="p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium">{a.title}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    题单: <Link href={`/problem-sets/${a.problemSet.id}`} className="underline">{a.problemSet.title}</Link> ({a.problemSet.count} 题)
                    {a.dueAt && <span className="ml-2"><Calendar className="inline h-3 w-3" /> 截止: {new Date(a.dueAt).toLocaleString("zh-CN")}</span>}
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </>
      )}

      {tab === "stats" && stats && (
        <>
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> 导出 CSV</Button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left p-2">#</th><th className="text-left p-2">姓名</th><th className="text-left p-2">邮箱</th>
              <th className="text-center p-2">已完成</th><th className="text-center p-2">总题数</th><th className="text-center p-2">完成率</th>
            </tr></thead>
            <tbody>
              {stats.students.map((s, i) => (
                <tr key={s.userId} className="border-b hover:bg-muted/50">
                  <td className="p-2">{i + 1}</td><td className="p-2 font-medium">{s.name ?? "—"}</td><td className="p-2 text-muted-foreground">{s.email ?? "—"}</td>
                  <td className="p-2 text-center font-mono">{s.solved}</td><td className="p-2 text-center font-mono">{s.totalProblems}</td>
                  <td className="p-2 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <div className="w-16 bg-muted rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${s.completionRate}%` }} /></div>
                      <span className="font-mono text-xs">{s.completionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
