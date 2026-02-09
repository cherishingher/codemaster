"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminImportExportPage() {
  const [jsonBody, setJsonBody] = React.useState(`{"problems":[]}`)
  const [csvBody, setCsvBody] = React.useState("title,difficulty,visibility,source,tags")
  const [result, setResult] = React.useState("")
  const [zipFile, setZipFile] = React.useState<File | null>(null)

  const importJson = async () => {
    const res = await fetch("/api/admin/problems/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: jsonBody,
    })
    setResult(await res.text())
  }

  const importCsv = async () => {
    const res = await fetch("/api/admin/problems/import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "text/csv" },
      body: csvBody,
    })
    setResult(await res.text())
  }

  const importZip = async () => {
    if (!zipFile) return
    const form = new FormData()
    form.append("zip", zipFile)
    const res = await fetch("/api/admin/problems/import-zip", {
      method: "POST",
      credentials: "include",
      body: form,
    })
    setResult(await res.text())
  }

  const exportJson = () => {
    window.open("/api/admin/problems/export", "_blank")
  }

  const exportCsv = () => {
    window.open("/api/admin/problems/export?format=csv", "_blank")
  }

  const exportSetsJson = () => {
    window.open("/api/admin/problem-sets/export", "_blank")
  }

  const exportSetsCsv = () => {
    window.open("/api/admin/problem-sets/export?format=csv", "_blank")
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">导入 / 导出</h1>
          <p className="text-muted-foreground mt-2">支持 JSON / CSV / ZIP</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-medium">导出题库 / 题单</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson}>导出题库(JSON)</Button>
            <Button onClick={exportCsv} variant="secondary">导出题库(CSV)</Button>
            <Button onClick={exportSetsJson} variant="secondary">导出题单(JSON)</Button>
            <Button onClick={exportSetsCsv} variant="secondary">导出题单(CSV)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-medium">JSON 导入</div>
          <textarea
            className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={jsonBody}
            onChange={(e) => setJsonBody(e.target.value)}
          />
          <Button onClick={importJson}>导入 JSON</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-medium">CSV 导入（基础字段）</div>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={csvBody}
            onChange={(e) => setCsvBody(e.target.value)}
          />
          <Button onClick={importCsv}>导入 CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="font-medium">ZIP 导入（含测试点文件）</div>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={importZip}>导入 ZIP</Button>
          <div className="text-xs text-muted-foreground">
            ZIP 需包含 manifest.json 或 problems.json，并可引用 inputPath/outputPath。
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
  )
}
