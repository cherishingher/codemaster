"use client"

import Link from "next/link"
import useSWR from "swr"
import { useState } from "react"
import { BookOpen, Search, ArrowRight } from "lucide-react"
import { api } from "@/lib/api-client"
import { Card, CardContent } from "@/components/ui/card"

type ProblemSetItem = {
  id: string; title: string; description: string | null; count: number
  owner: { name: string | null }; createdAt: string
}

export default function ProblemSetsPage() {
  const [q, setQ] = useState("")
  const params: Record<string, string> = {}
  if (q) params.q = q

  const { data } = useSWR(["problem-sets", q], () => api.problemSets.list<ProblemSetItem[]>(params))

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">题单</h1>
          <p className="text-muted-foreground mt-1">按知识点和难度组织的刷题路线</p>
        </div>
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
          placeholder="搜索题单..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-3">
        {data?.map((s) => (
          <Link key={s.id} href={`/problem-sets/${s.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.count} 题 · {s.owner.name ?? "匿名"}
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {data?.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">暂无公开题单</p>
        )}
      </div>
    </div>
  )
}
