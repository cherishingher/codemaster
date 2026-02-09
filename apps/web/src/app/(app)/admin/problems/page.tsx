"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

type Problem = {
  id: string
  title: string
  difficulty: number
  visibility: string
  source?: string | null
  tags: string[]
  version: number | null
  stats?: {
    totalSubmissions: number
    acceptedSubmissions: number
    passRate: number
  } | null
}

export default function AdminProblemsPage() {
  const [items, setItems] = React.useState<Problem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("3")
  const [visibility, setVisibility] = React.useState("public")
  const [source, setSource] = React.useState("")
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [statement, setStatement] = React.useState("")
  const [constraints, setConstraints] = React.useState("")
  const [inputFormat, setInputFormat] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState("")
  const [samples, setSamples] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [timeLimitMs, setTimeLimitMs] = React.useState("1000")
  const [memoryLimitMb, setMemoryLimitMb] = React.useState("256")

  const languageTags = [
    "scratch-必做",
    "scratch-可选",
    "C++",
    "Python",
  ]

  const dataStructureTags = [
    "数组",
    "链表",
    "栈",
    "队列",
    "哈希表",
    "堆",
    "树",
    "二叉树",
    "二叉搜索树",
    "平衡树",
    "线段树",
    "树状数组",
    "图",
    "并查集",
    "字符串",
    "字典树",
    "位运算",
  ]

  const algorithmTags = [
    "双指针",
    "贪心",
    "动态规划",
    "回溯",
    "DFS",
    "BFS",
    "最短路",
    "拓扑排序",
    "最小生成树",
    "分治",
    "二分",
    "排序",
    "模拟",
    "数学",
    "数论",
    "枚举",
    "前缀和",
    "差分",
    "滑动窗口",
    "单调栈",
    "单调队列",
    "扫描线",
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/problems", { credentials: "include" })
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const createProblem = async () => {
    const payload: Record<string, unknown> = {
      title,
      difficulty: Number(difficulty),
      visibility,
      source: source || undefined,
      tags: selectedTags.length ? selectedTags : undefined,
    }

    if (statement || constraints || inputFormat || outputFormat || samples || notes) {
      payload.statement = statement || ""
      payload.constraints = constraints || undefined
      payload.inputFormat = inputFormat || undefined
      payload.outputFormat = outputFormat || undefined
      payload.notes = notes || undefined
      payload.timeLimitMs = Number(timeLimitMs || 1000)
      payload.memoryLimitMb = Number(memoryLimitMb || 256)
      if (samples) {
        try {
          payload.samples = JSON.parse(samples)
        } catch {
          payload.samples = []
        }
      }
    }

    await fetch("/api/admin/problems", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setTitle("")
    setSelectedTags([])
    setStatement("")
    setConstraints("")
    setInputFormat("")
    setOutputFormat("")
    setSamples("")
    setNotes("")
    await load()
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题库管理</h1>
          <p className="text-muted-foreground mt-2">创建题目与查看列表</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              placeholder="难度 1-10"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            />
            <Input
              placeholder="来源"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="可见性 public/private/hidden/contest"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              题目标签（多选）：语言 / 数据结构 / 算法
            </div>
            <TagGroup title="语言标签" tags={languageTags} selected={selectedTags} onToggle={toggleTag} />
            <TagGroup title="数据结构" tags={dataStructureTags} selected={selectedTags} onToggle={toggleTag} />
            <TagGroup title="算法标签" tags={algorithmTags} selected={selectedTags} onToggle={toggleTag} />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="时间限制 ms"
              value={timeLimitMs}
              onChange={(e) => setTimeLimitMs(e.target.value)}
            />
            <Input
              placeholder="内存限制 MB"
              value={memoryLimitMb}
              onChange={(e) => setMemoryLimitMb(e.target.value)}
            />
          </div>

          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="题目描述 statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
          <div className="grid md:grid-cols-2 gap-3">
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="输入格式 inputFormat"
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
            />
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="输出格式 outputFormat"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
            />
          </div>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="约束 constraints"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder='样例 JSON，例如 [{"input":"1","output":"2"}]'
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
          />
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="备注 notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={createProblem}>创建题目</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground mb-3">
            {loading ? "加载中..." : `共 ${items.length} 个题目`}
          </div>
          <div className="space-y-2">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-border pb-2"
              >
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    难度 {p.difficulty} · 版本 {p.version ?? "-"} · {p.visibility}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/problems/${p.id}`}>
                    <Button size="sm">管理</Button>
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    AC {p.stats?.acceptedSubmissions ?? 0}/{p.stats?.totalSubmissions ?? 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TagGroup({
  title,
  tags,
  selected,
  onToggle,
}: {
  title: string
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-zinc-200">{title}</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-700"
              }`}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
