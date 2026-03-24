import * as React from "react"
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { getSubmissionStatusLabel } from "@/lib/submissions"
import { cn } from "@/lib/utils"

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

function getCaseStatusCode(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "ACCEPTED":
    case "AC":
      return "AC"
    case "WRONG_ANSWER":
    case "WA":
      return "WA"
    case "TIME_LIMIT_EXCEEDED":
    case "TLE":
      return "TLE"
    case "MEMORY_LIMIT_EXCEEDED":
    case "MLE":
      return "MLE"
    case "RUNTIME_ERROR":
    case "RE":
      return "RE"
    case "COMPILE_ERROR":
    case "CE":
      return "CE"
    case "PENDING":
    case "QUEUED":
      return "WAIT"
    case "JUDGING":
    case "RUNNING":
      return "RUN"
    case "PARTIAL":
    case "PARTIAL_ACCEPTED":
      return "PART"
    default:
      return status?.toUpperCase() || "UNK"
  }
}

function formatCaseMemory(memoryMb?: number | null) {
  if (!memoryMb) return "0KB"
  if (memoryMb >= 1) {
    return `${memoryMb.toFixed(memoryMb >= 10 ? 0 : 2)}MB`
  }
  return `${(memoryMb * 1024).toFixed(2)}KB`
}

const tonePanelClass: Record<ReturnType<TestcaseListProps["getTone"]>, string> = {
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-800",
  warning: "border-amber-500/35 bg-amber-500/14 text-amber-800",
  danger: "border-red-500/35 bg-red-500/14 text-red-800",
  info: "border-sky-500/35 bg-sky-500/14 text-sky-800",
  muted: "border-border/70 bg-background text-foreground",
}

export function TestcaseList({ cases, getTone }: TestcaseListProps) {
  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (cases.length === 0) {
      setSelectedCaseId(null)
      return
    }
    setSelectedCaseId((current) => {
      if (current && cases.some((item) => item.id === current)) {
        return current
      }
      const firstInteresting =
        cases.find((item) => !["ACCEPTED", "AC"].includes((item.status ?? "").toUpperCase())) ?? cases[0]
      return firstInteresting.id
    })
  }, [cases])

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

  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? cases[0]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cases.map((item) => {
          const tone = getTone(item.status)
          const isSelected = item.id === selectedCase.id
          const isRunning = ["PENDING", "QUEUED", "JUDGING", "RUNNING"].includes((item.status ?? "").toUpperCase())

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCaseId(item.id)}
              className={cn(
                "min-h-[124px] rounded-[1.45rem] border-[3px] px-4 py-3 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                tonePanelClass[tone],
                isSelected ? "ring-2 ring-foreground/20 ring-offset-2" : "opacity-95"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                  #{item.ordinal ?? "-"}
                </span>
                {item.testcase?.isSample ? <StatusBadge tone="info">样例</StatusBadge> : null}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[1.75rem] font-black leading-none tracking-tight">
                  {getCaseStatusCode(item.status)}
                </span>
                {isRunning ? <Loader2 className="size-4 animate-spin" /> : null}
              </div>
              <div className="mt-4 space-y-1 text-xs font-medium">
                <p>
                  {item.timeMs ?? 0}ms / {formatCaseMemory(item.memoryMb)}
                </p>
                <p>得分 {item.score ?? 0}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="surface-inset rounded-[1.6rem] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-foreground">
                测试点 {selectedCase.ordinal ?? "-"}
                {selectedCase.testcase?.title ? ` · ${selectedCase.testcase.title}` : ""}
              </p>
              <StatusBadge tone={getTone(selectedCase.status)}>
                {getSubmissionStatusLabel((selectedCase.status ?? "PENDING") as never)}
              </StatusBadge>
              {selectedCase.testcase?.isSample ? <StatusBadge tone="info">样例</StatusBadge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              选中某个测试点后，可以直接查看该点的时间、内存、得分和对拍预览。
            </p>
          </div>
          <div className="grid min-w-[220px] gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border-[2px] border-border bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">耗时</p>
              <p className="mt-1 text-base font-semibold text-foreground">{selectedCase.timeMs ?? 0} ms</p>
            </div>
            <div className="rounded-[1.2rem] border-[2px] border-border bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">内存</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatCaseMemory(selectedCase.memoryMb)}</p>
            </div>
            <div className="rounded-[1.2rem] border-[2px] border-border bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">得分</p>
              <p className="mt-1 text-base font-semibold text-foreground">{selectedCase.score ?? 0}</p>
            </div>
          </div>
        </div>

        {selectedCase.checkerMessage ? (
          <div className="mt-4 rounded-[1.2rem] border-[2px] border-border/70 bg-white px-4 py-3 text-sm text-muted-foreground">
            {selectedCase.checkerMessage}
          </div>
        ) : null}

        {selectedCase.inputPreview || selectedCase.outputPreview || selectedCase.expectedPreview ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {selectedCase.inputPreview ? (
              <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  输入预览
                  <ChevronRight className="size-3" />
                </p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                  {selectedCase.inputPreview}
                </pre>
              </div>
            ) : null}
            {selectedCase.outputPreview ? (
              <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  输出预览
                  <ChevronRight className="size-3" />
                </p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                  {selectedCase.outputPreview}
                </pre>
              </div>
            ) : null}
            {selectedCase.expectedPreview ? (
              <div className="rounded-[1.2rem] border-[2px] border-border bg-white p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  期望预览
                  <ChevronRight className="size-3" />
                </p>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                  {selectedCase.expectedPreview}
                </pre>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-[1.2rem] border-[2px] border-dashed border-border bg-white px-4 py-4 text-sm text-muted-foreground">
            这个测试点暂时没有输入、输出或期望值预览。
          </div>
        )}
      </div>
    </div>
  )
}
