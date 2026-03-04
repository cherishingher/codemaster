"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

const JSON_TEMPLATE_FULL = {
  problems: [
    {
      title: "Sample Problem",
      difficulty: 3,
      visibility: "public",
      source: "import",
      tags: ["数组", "哈希表", "C++"],
      versions: [
        {
          statement: "Describe the problem here.",
          statementMd:
            "## 题目描述\n\n给定一个整数数组，返回满足条件的答案。\n\n- 支持 **Markdown**\n- 支持行内公式 `$a+b$`",
          constraints: "1 <= n <= 1e5",
          hints: "优先考虑哈希表或前缀和。",
          inputFormat: "n\\nnums...",
          outputFormat: "answer",
          samples: [
            {
              input: "3\\n1 2 3",
              output: "6",
              explain: "三个数字求和后得到 6。",
            },
          ],
          notes: "Any notes",
          timeLimitMs: 1000,
          memoryLimitMb: 256,
          testcases: [
            {
              input: "3\\n1 2 3",
              output: "6",
              score: 100,
              isSample: true,
              orderIndex: 1,
            },
          ],
        },
      ],
      solutions: [
        {
          title: "Official",
          content: "Explain the approach",
          type: "official",
          visibility: "public",
        },
      ],
    },
  ],
}

const JSON_TEMPLATE_MINIMAL = {
  problems: [
    {
      title: "Minimal Problem",
      difficulty: 2,
      versions: [
        {
          statement: "Problem statement",
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        },
      ],
    },
  ],
}

const CSV_TEMPLATE = `title,difficulty,visibility,source,tags
"Two Sum",2,public,"leetcode","array|hash"
`

const ZIP_MANIFEST_TEMPLATE = {
  problems: [
    {
      title: "ZIP Imported Problem",
      difficulty: 3,
      visibility: "public",
      source: "zip-import",
      tags: ["数组", "C++"],
      versions: [
        {
          statement: "Describe the problem here.",
          statementMd: "## ZIP 导入题面\\n\\n支持 Markdown。",
          hints: "manifest 中可直接带 hints。",
          notes: "配套测试点文件在 ZIP 内部。",
          timeLimitMs: 1000,
          memoryLimitMb: 256,
          testcases: [
            {
              inputPath: "fixtures/case1.in",
              outputPath: "fixtures/case1.out",
              score: 100,
              isSample: true,
              orderIndex: 1,
            },
          ],
        },
      ],
    },
  ],
}

const TESTCASE_BATCH_ZIP_LAYOUT = `batch-testcases.zip
├── a-b-problem/
│   ├── 1.in
│   ├── 1.out
│   ├── 2.in
│   ├── 2.out
│   └── config.yml
├── problem-522/
│   ├── 1.in
│   └── 1.out
└── cml5btc6100005gpyhtet146j/
    ├── 1.in
    └── 1.out
`

type ResultState = {
  ok: boolean
  status: number
  body: string
}

function stringifyTemplate(value: unknown) {
  return JSON.stringify(value, null, 2)
}

async function formatResponse(res: Response) {
  const raw = await res.text()
  try {
    return stringifyTemplate(JSON.parse(raw))
  } catch {
    return raw || "(empty)"
  }
}

export default function AdminImportExportPage() {
  const [jsonBody, setJsonBody] = React.useState(() => stringifyTemplate(JSON_TEMPLATE_FULL))
  const [csvBody, setCsvBody] = React.useState(CSV_TEMPLATE)
  const [result, setResult] = React.useState<ResultState | null>(null)
  const [zipFile, setZipFile] = React.useState<File | null>(null)
  const [testcaseZipFile, setTestcaseZipFile] = React.useState<File | null>(null)
  const [skipTestcaseZipSync, setSkipTestcaseZipSync] = React.useState(true)
  const [busy, setBusy] = React.useState<"json" | "csv" | "zip" | "testcaseZip" | null>(null)

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label}已复制`)
    } catch {
      toast.error(`${label}复制失败`)
    }
  }

  const runAction = async (
    kind: "json" | "csv" | "zip" | "testcaseZip",
    action: () => Promise<Response>
  ) => {
    setBusy(kind)
    const res = await action()
    const body = await formatResponse(res)
    setResult({
      ok: res.ok,
      status: res.status,
      body,
    })
    setBusy(null)
  }

  const importJson = async () => {
    await runAction("json", () =>
      fetch("/api/admin/problems/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: jsonBody,
      })
    )
  }

  const importCsv = async () => {
    await runAction("csv", () =>
      fetch("/api/admin/problems/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "text/csv" },
        body: csvBody,
      })
    )
  }

  const importZip = async () => {
    if (!zipFile) return
    const form = new FormData()
    form.append("zip", zipFile)
    await runAction("zip", () =>
      fetch("/api/admin/problems/import-zip", {
        method: "POST",
        credentials: "include",
        body: form,
      })
    )
  }

  const importTestcaseZip = async () => {
    if (!testcaseZipFile) return
    const form = new FormData()
    form.append("zip", testcaseZipFile)
    form.append("skipSync", String(skipTestcaseZipSync))
    await runAction("testcaseZip", () =>
      fetch("/api/admin/testcases/import-zip", {
        method: "POST",
        credentials: "include",
        body: form,
      })
    )
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
          <p className="mt-2 text-muted-foreground">支持 JSON / CSV / ZIP，题面字段已兼容 Markdown。</p>
        </div>
        <Link href="/admin">
          <Button variant="secondary">返回工具页</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">导出题库 / 题单</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="outline">`statement` + `statementMd`</Badge>
                <Badge variant="outline">`hints` 与 `notes` 分离</Badge>
                <Badge variant="outline">JSON 可完整往返</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportJson}>导出题库(JSON)</Button>
              <Button onClick={exportCsv} variant="secondary">
                导出题库(CSV)
              </Button>
              <Button onClick={exportSetsJson} variant="secondary">
                导出题单(JSON)
              </Button>
              <Button onClick={exportSetsCsv} variant="secondary">
                导出题单(CSV)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="json" className="space-y-4">
        <TabsList>
          <TabsTrigger value="json">JSON 导入</TabsTrigger>
          <TabsTrigger value="csv">CSV 导入</TabsTrigger>
          <TabsTrigger value="zip">ZIP 导入</TabsTrigger>
          <TabsTrigger value="testcase-zip">测试点批量 ZIP</TabsTrigger>
        </TabsList>

        <TabsContent value="json">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">JSON 导入</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    完整导入题目、版本、测试点和题解。`statementMd`、`hints`、`notes` 都支持。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setJsonBody(stringifyTemplate(JSON_TEMPLATE_MINIMAL))}
                  >
                    载入最小模板
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setJsonBody(stringifyTemplate(JSON_TEMPLATE_FULL))}
                  >
                    载入完整模板
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => copyText("JSON 模板", stringifyTemplate(JSON_TEMPLATE_FULL))}
                  >
                    复制模板
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-xs text-muted-foreground">
                <div>`statement`: 纯文本题面兜底</div>
                <div>`statementMd`: Markdown 题面优先字段</div>
                <div>`hints`: 做题提示，`notes`: 备注</div>
              </div>

              <textarea
                className="min-h-[320px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={jsonBody}
                onChange={(e) => setJsonBody(e.target.value)}
              />
              <Button onClick={importJson} disabled={busy !== null}>
                {busy === "json" ? "导入中..." : "导入 JSON"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">CSV 导入（基础字段）</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    只导入标题 / 难度 / 可见性 / 来源 / 标签，不包含版本和测试点。
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setCsvBody(CSV_TEMPLATE)}>
                    重置 CSV 模板
                  </Button>
                  <Button variant="ghost" onClick={() => copyText("CSV 模板", CSV_TEMPLATE)}>
                    复制模板
                  </Button>
                </div>
              </div>

              <textarea
                className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={csvBody}
                onChange={(e) => setCsvBody(e.target.value)}
              />
              <Button onClick={importCsv} disabled={busy !== null}>
                {busy === "csv" ? "导入中..." : "导入 CSV"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zip">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">ZIP 导入（含测试点文件）</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ZIP 内必须包含 `manifest.json` 或 `problems.json`，测试点可用 `inputPath/outputPath` 引用。
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => copyText("manifest 模板", stringifyTemplate(ZIP_MANIFEST_TEMPLATE))}
                >
                  复制 manifest 模板
                </Button>
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                <div>测试点文件示例：`fixtures/case1.in` / `fixtures/case1.out`</div>
                <div>`manifest.json` 可带 `statementMd`、`hints`、`notes`</div>
                <div>样例与隐藏点都在 `versions[].testcases` 中声明</div>
              </div>

              <textarea
                className="min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                readOnly
                value={stringifyTemplate(ZIP_MANIFEST_TEMPLATE)}
              />

              <input
                type="file"
                accept=".zip"
                onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                className="block"
              />
              <Button onClick={importZip} disabled={!zipFile || busy !== null}>
                {busy === "zip" ? "导入中..." : "导入 ZIP"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testcase-zip">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">测试点批量 ZIP 导入</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    一个 ZIP 同时覆盖多道题的测试点。目录名必须是题目的 `slug` 或数据库 `id`。
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => copyText("测试点批量 ZIP 目录示例", TESTCASE_BATCH_ZIP_LAYOUT)}
                >
                  复制目录示例
                </Button>
              </div>

              <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                <div>每道题一个目录：`a-b-problem/1.in`、`a-b-problem/1.out`</div>
                <div>目录内可选 `config.yml/config.yaml`，格式与单题测试点 ZIP 完全一致</div>
                <div>上传后会覆盖该题最新版本测试点，并同步 HUSTOJ</div>
              </div>

              <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/20 p-4 text-sm">
                {TESTCASE_BATCH_ZIP_LAYOUT}
              </pre>

              <input
                type="file"
                accept=".zip"
                onChange={(e) => setTestcaseZipFile(e.target.files?.[0] ?? null)}
                className="block"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={skipTestcaseZipSync}
                  onChange={(e) => setSkipTestcaseZipSync(e.target.checked)}
                />
                跳过 HUSTOJ 同步，只更新本地题库测试点
              </label>
              <Button onClick={importTestcaseZip} disabled={!testcaseZipFile || busy !== null}>
                {busy === "testcaseZip" ? "导入中..." : "导入测试点批量 ZIP"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">响应结果</div>
              <div className="text-xs text-muted-foreground">
                自动格式化 JSON；便于直接看错误码和字段校验信息。
              </div>
            </div>
            {result ? (
              <Badge variant={result.ok ? "outline" : "destructive"}>
                HTTP {result.status}
              </Badge>
            ) : null}
          </div>
          <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/20 p-4 text-sm">
            {result?.body || "暂无"}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
