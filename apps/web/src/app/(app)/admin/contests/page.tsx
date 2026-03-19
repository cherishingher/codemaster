"use client"

import { useState } from "react"
import useSWR from "swr"
import { client } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Plus, Trash2, Edit2, Users, Trophy } from "lucide-react"

type Contest = {
  id: string; name: string; rule: string; startAt: string; endAt: string
  participantCount: number; problemCount: number
  problems: { id: string; title: string; slug: string; order: number }[]
}

export default function AdminContestsPage() {
  const { data, mutate } = useSWR("admin-contests", () =>
    client<{ items: Contest[] }>("/admin/contests")
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", startAt: "", endAt: "", rule: "ACM", problemIds: "" })

  async function handleCreate() {
    try {
      await client("/admin/contests", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          rule: form.rule,
          problemIds: form.problemIds.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      })
      toast.success("比赛创建成功")
      setShowForm(false)
      setForm({ name: "", startAt: "", endAt: "", rule: "ACM", problemIds: "" })
      mutate()
    } catch (e: any) {
      toast.error(e.message || "创建失败")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除？")) return
    try {
      await client(`/admin/contests/${id}`, { method: "DELETE" })
      toast.success("已删除")
      mutate()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6" /> 比赛管理</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> 新建比赛
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="比赛名称"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">开始时间</label>
                <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm"
                  value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">结束时间</label>
                <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm"
                  value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            <select className="border rounded px-3 py-2 text-sm"
              value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })}>
              <option value="ACM">ACM</option>
              <option value="OI">OI</option>
              <option value="IOI">IOI</option>
            </select>
            <input className="w-full border rounded px-3 py-2 text-sm"
              placeholder="题目 ID（逗号分隔）" value={form.problemIds}
              onChange={(e) => setForm({ ...form, problemIds: e.target.value })} />
            <Button onClick={handleCreate}>创建</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.rule}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(c.startAt).toLocaleString("zh-CN")} — {new Date(c.endAt).toLocaleString("zh-CN")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <Users className="inline h-3 w-3 mr-1" />{c.participantCount} 人 · {c.problemCount} 题
                  {c.problems.length > 0 && (
                    <span className="ml-2">({c.problems.map((p) => p.title).join(", ")})</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {data?.items.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">暂无比赛</p>
        )}
      </div>
    </div>
  )
}
