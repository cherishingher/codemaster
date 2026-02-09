"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

type ProblemSet = {
  id: string
  title: string
  description?: string | null
  visibility: string
  count: number
}

export default function AdminProblemSetsPage() {
  const [sets, setSets] = React.useState<ProblemSet[]>([])
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [visibility, setVisibility] = React.useState("public")
  const [setId, setSetId] = React.useState("")
  const [problemId, setProblemId] = React.useState("")
  const [orderIndex, setOrderIndex] = React.useState("1")

  const load = React.useCallback(async () => {
    const res = await fetch("/api/admin/problem-sets", { credentials: "include" })
    const data = await res.json()
    setSets(data)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const createSet = async () => {
    await fetch("/api/admin/problem-sets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, visibility }),
    })
    setTitle("")
    setDescription("")
    await load()
  }

  const addItem = async () => {
    if (!setId || !problemId) return
    await fetch(`/api/admin/problem-sets/${setId}/items`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            problemId,
            orderIndex: Number(orderIndex || 1),
          },
        ],
      }),
    })
    setProblemId("")
    await load()
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题单管理</h1>
          <p className="text-muted-foreground mt-2">创建题单与维护题目顺序</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">创建题单</h2>
          <Input placeholder="题单标题" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            placeholder="描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="可见性 public/private/hidden"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          />
          <Button onClick={createSet}>创建题单</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">添加题目到题单</h2>
          <Input
            placeholder="题单 ID"
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
          />
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="题目 ID"
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
            />
            <Input
              placeholder="排序 orderIndex"
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
            />
          </div>
          <Button onClick={addItem}>添加题目</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">题单列表</h2>
          {sets.map((s) => (
            <div key={s.id} className="border-b border-border pb-2">
              <div className="font-medium">{s.title}</div>
              <div className="text-xs text-muted-foreground">
                {s.id} · {s.visibility} · {s.count} 题
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
