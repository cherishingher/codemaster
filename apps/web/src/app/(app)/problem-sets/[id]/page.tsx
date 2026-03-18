"use client"

import { useParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { BookOpen, CheckCircle, Circle, Minus } from "lucide-react"
import { api } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"

type ProblemSetDetail = {
  id: string; title: string; description: string | null
  owner: { name: string | null }
  items: {
    orderIndex: number
    problem: { id: string; title: string; difficulty: number; tags: string[] }
  }[]
}

type ProgressItem = { problemId: string; status: number }

const diffLabel = ["", "入门", "简单", "中等", "困难", "竞赛"]
const diffColor = ["", "text-green-600", "text-blue-600", "text-yellow-600", "text-orange-600", "text-red-600"]

export default function ProblemSetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: set } = useSWR(id ? ["ps", id] : null, () => api.problemSets.get<ProblemSetDetail>(id))
  const { data: progress } = useSWR("my-progress", () => api.progress.list<ProgressItem[]>().catch(() => []))

  const progressMap = new Map<string, number>()
  if (Array.isArray(progress)) {
    progress.forEach((p) => progressMap.set(p.problemId, p.status))
  }

  if (!set) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">加载中...</div>
  }

  const solved = set.items.filter((i) => progressMap.get(i.problem.id) === 20).length

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> {set.title}
        </h1>
        {set.description && <p className="text-muted-foreground mt-1">{set.description}</p>}
        <div className="text-sm text-muted-foreground mt-2">
          {set.owner.name ?? "匿名"} · {set.items.length} 题 · 已完成 {solved}/{set.items.length}
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${set.items.length > 0 ? (solved / set.items.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {set.items.map((item, idx) => {
          const status = progressMap.get(item.problem.id)
          const isAC = status === 20
          const isAttempted = status === 10
          return (
            <Link key={item.problem.id} href={`/problems/${item.problem.id}`}>
              <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="w-8 text-center font-mono text-muted-foreground text-sm">{idx + 1}</span>
                  {isAC ? <CheckCircle className="h-5 w-5 text-green-500" /> :
                   isAttempted ? <Circle className="h-5 w-5 text-yellow-500" /> :
                   <Minus className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <span className="font-medium">{item.problem.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${diffColor[item.problem.difficulty] || "text-muted-foreground"}`}>
                        {diffLabel[item.problem.difficulty] || `Lv.${item.problem.difficulty}`}
                      </span>
                      {item.problem.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-xs bg-muted px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
