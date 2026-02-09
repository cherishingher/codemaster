"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Overview = {
  counts: {
    users: number
    problems: number
    submissions: number
    accepted: number
    problemSets: number
    solutions: number
    activeUsers7d: number
  }
  recentSubmissions: { day: string; total: number; accepted: number }[]
  topProblems: { problemId: string; title: string; total: number; accepted: number }[]
}

export default function AdminStatsPage() {
  const [data, setData] = React.useState<Overview | null>(null)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    fetch("/api/admin/stats/overview", { credentials: "include" })
      .then(async (r) => {
        const payload = await r.json().catch(() => null)
        if (!r.ok) {
          setError(payload?.error ?? "unauthorized")
          return
        }
        setData(payload)
      })
  }, [])

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">运营统计</h1>
          <p className="text-muted-foreground mt-2">全站数据概览</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 grid md:grid-cols-3 gap-4">
          <div>用户：{data?.counts?.users ?? 0}</div>
          <div>题目：{data?.counts?.problems ?? 0}</div>
          <div>提交：{data?.counts?.submissions ?? 0}</div>
          <div>通过：{data?.counts?.accepted ?? 0}</div>
          <div>题单：{data?.counts?.problemSets ?? 0}</div>
          <div>题解：{data?.counts?.solutions ?? 0}</div>
          <div>活跃用户(7d)：{data?.counts?.activeUsers7d ?? 0}</div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            无权限或未登录：{error}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="font-medium">近 14 天提交</div>
          {data?.recentSubmissions?.map((r) => (
            <div key={r.day} className="text-sm text-muted-foreground">
              {r.day}：{r.total} 提交，{r.accepted} 通过
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="font-medium">热门题目 Top 10</div>
          {data?.topProblems?.map((p) => (
            <div key={p.problemId} className="text-sm text-muted-foreground">
              {p.title}：{p.total} 提交，{p.accepted} 通过
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
