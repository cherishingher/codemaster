"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { isAdminDevToolsVisible } from "@/lib/admin-dev"

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
  const showAdminDevTools = isAdminDevToolsVisible()
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
        <h1 className="text-3xl font-bold tracking-tight">运营与维护后台</h1>
        <p className="text-muted-foreground mt-2">
          正式运营入口集中在上方；开发自检和演示工具统一收在下方，避免和日常配置流程混用。
        </p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardContent className="p-6 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/problems">题库管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/problem-sets">题单管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/store-products">商品管理</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/content">内容后台</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/organizations">机构后台</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/teachers">教师后台</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/classes">班级后台</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/import-export">导入导出</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/stats">运营统计</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/analytics">学习分析</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/submit-test">提交测试</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">开发与诊断工具</h2>
              <p className="text-sm text-muted-foreground">
                仅在联调接口、生成演示数据或执行后台自检时使用。日常运营优先使用上方正式入口。
              </p>
            </div>
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
              {showAdminDevTools ? (
                <>
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
                </>
              ) : null}
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
            <p className="text-xs text-muted-foreground">
              {showAdminDevTools
                ? "当前环境已开启开发工具入口，可用于自测、诊断和演示数据初始化。"
                : "当前环境未开启开发工具入口，仅保留正式运营能力。"}
            </p>
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
