"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SubmissionResult } from "@/components/problems/submission-result"
import { useSubmission } from "@/lib/hooks/use-submission"

const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;
int main(){
  long long a,b;
  if(!(cin>>a>>b)) return 0;
  cout<<a+b;
  return 0;
}
`

export default function SubmitTestPage() {
  const [problemId, setProblemId] = React.useState("")
  const [language, setLanguage] = React.useState("cpp17")
  const [code, setCode] = React.useState(DEFAULT_CODE)
  const [submissionId, setSubmissionId] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const { submission, isLoading: resultLoading } = useSubmission(
    submissionId ? submissionId : null
  )

  const submit = async () => {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/problems/${problemId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) {
        setMessage(text || `提交失败 (HTTP ${res.status})`)
        return
      }
      setSubmissionId(data.submissionId)
      setMessage(`提交成功：${data.submissionId}`)
    } catch (err) {
      setMessage(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">提交测试</h1>
          <p className="text-muted-foreground mt-2">快速提交与查看判题结果</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <Input
            placeholder="题目 ID"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="cpp11">C++11</option>
            <option value="cpp14">C++14</option>
            <option value="cpp17">C++17</option>
            <option value="python">Python</option>
          </select>
          <textarea
            className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button onClick={submit} disabled={loading || !problemId}>
            {loading ? "提交中..." : "提交"}
          </Button>
          <div className="text-xs text-muted-foreground break-all">
            {message || "暂无"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-medium">评测结果</div>
          <Input
            placeholder="submissionId"
            value={submissionId}
            onChange={(e) => setSubmissionId(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            自动轮询，无需手动查询
          </div>
          <SubmissionResult submission={submission} isLoading={resultLoading} />
          <pre className="text-sm whitespace-pre-wrap break-all">
            {submission ? JSON.stringify(submission, null, 2) : "暂无"}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
