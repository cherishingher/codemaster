"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

const defaultPayload = {
  problems: [
    {
      title: "Sample Problem",
      difficulty: 3,
      visibility: "public",
      source: "import",
      tags: ["array", "hashmap"],
      versions: [
        {
          statement: "Describe the problem here.",
          constraints: "1 <= n <= 1e5",
          inputFormat: "n\\nnums...",
          outputFormat: "answer",
          samples: [{ input: "3\\n1 2 3", output: "6" }],
          notes: "Any notes",
          timeLimitMs: 1000,
          memoryLimitMb: 256,
          testcases: [
            { input: "3\\n1 2 3", output: "6", score: 100, isSample: true, orderIndex: 1 },
          ],
        },
      ],
      solutions: [
        { title: "Official", content: "Explain the approach", type: "official", visibility: "public" },
      ],
    },
  ],
}

export default function AdminToolsPage() {
  const [endpoint, setEndpoint] = React.useState("/api/admin/problems/import")
  const [method, setMethod] = React.useState("POST")
  const [body, setBody] = React.useState(JSON.stringify(defaultPayload, null, 2))
  const [result, setResult] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const send = async () => {
    setLoading(true)
    setResult("")
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : body,
      })
      const text = await res.text()
      setResult(text)
    } catch (err) {
      setResult(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8 px-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Toolbox</h1>
        <p className="text-muted-foreground mt-2">
          快速调用后端管理接口（导入/导出/题库管理/自测）
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-6 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/problems">题库管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/contests">比赛管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/problem-sets">题单管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/users">用户管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/import-export">导入导出</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/stats">运营统计</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/submit-test">提交测试</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Endpoint</label>
              <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">Method</label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted-foreground">JSON Body</label>
              <textarea
                className="min-h-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={send} disabled={loading}>
                {loading ? "请求中..." : "发送请求"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEndpoint("/api/admin/dev/self-test")
                  setMethod("GET")
                  setBody("")
                }}
              >
                自测
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEndpoint("/api/admin/dev/seed")
                  setMethod("POST")
                  setBody("")
                }}
              >
                生成 Mock 数据
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEndpoint("/api/admin/problems/export")
                  setMethod("GET")
                  setBody("")
                }}
              >
                导出题库(JSON)
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEndpoint("/api/admin/problem-sets/export")
                  setMethod("GET")
                  setBody("")
                }}
              >
                导出题单(JSON)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground mb-2">Response</div>
            <pre className="whitespace-pre-wrap break-all text-sm">{result || "暂无"}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
