import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { getSubmissionStatusLabel } from "@/lib/submissions"

type SubmissionCase = {
  id: string
  ordinal?: number | null
  status?: string | null
  timeMs?: number | null
  memoryMb?: number | null
  score?: number | null
  checkerMessage?: string | null
  inputPreview?: string | null
  outputPreview?: string | null
  expectedPreview?: string | null
  testcase?: {
    title?: string | null
    isSample?: boolean | null
  } | null
}

type TestcaseListProps = {
  cases: SubmissionCase[]
  getTone: (status?: string | null) => "success" | "warning" | "danger" | "info" | "muted"
}

export function TestcaseList({ cases, getTone }: TestcaseListProps) {
  if (cases.length === 0) {
    return (
      <Card className="rounded-[1.5rem] border-[2px] border-dashed border-border bg-background shadow-none">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <AlertTriangle className="size-4" />
          当前提交还没有返回测试点详情，可能仍在评测中，或者后端未附带用例信息。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {cases.map((item) => (
        <div key={item.id} className="surface-inset rounded-[1.5rem] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                测试点 {item.ordinal ?? "-"}
                {item.testcase?.title ? ` · ${item.testcase.title}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={getTone(item.status)}>{getSubmissionStatusLabel((item.status ?? "PENDING") as never)}</StatusBadge>
                {item.testcase?.isSample ? <StatusBadge tone="info">样例</StatusBadge> : null}
              </div>
            </div>
            <div className="grid min-w-[220px] gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em]">耗时</p>
                <p className="mt-1 font-semibold text-foreground">{item.timeMs ?? 0} ms</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em]">内存</p>
                <p className="mt-1 font-semibold text-foreground">{item.memoryMb ?? 0} MB</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em]">得分</p>
                <p className="mt-1 font-semibold text-foreground">{item.score ?? 0}</p>
              </div>
            </div>
          </div>
          {item.checkerMessage ? (
            <div className="mt-3 rounded-[1.2rem] border-[2px] border-border/70 bg-white px-4 py-3 text-sm text-muted-foreground">
              {item.checkerMessage}
            </div>
          ) : null}
          {item.inputPreview || item.outputPreview || item.expectedPreview ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {item.inputPreview ? (
                <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">输入预览</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                    {item.inputPreview}
                  </pre>
                </div>
              ) : null}
              {item.outputPreview ? (
                <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">输出预览</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                    {item.outputPreview}
                  </pre>
                </div>
              ) : null}
              {item.expectedPreview ? (
                <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">期望预览</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                    {item.expectedPreview}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
