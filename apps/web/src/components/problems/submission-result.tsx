"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Submission, SubmissionStatus } from "@/lib/hooks/use-submission"

interface SubmissionResultProps {
  submission: Submission | undefined;
  isLoading: boolean;
}

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const statusMap: Record<SubmissionStatus, { label: string; color: string; icon: IconType }> = {
  PENDING: { label: "等待中", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700", icon: Clock },
  JUDGING: { label: "评测中", color: "border-blue-500/40 bg-blue-500/10 text-blue-700", icon: Loader2 },
  ACCEPTED: { label: "解答正确", color: "border-green-500/40 bg-green-500/10 text-green-700", icon: CheckCircle2 },
  PARTIAL: { label: "部分正确", color: "border-amber-500/40 bg-amber-500/10 text-amber-700", icon: CheckCircle2 },
  WRONG_ANSWER: { label: "答案错误", color: "border-red-500/40 bg-red-500/10 text-red-700", icon: XCircle },
  TIME_LIMIT_EXCEEDED: { label: "时间超限", color: "border-orange-500/40 bg-orange-500/10 text-orange-700", icon: Clock },
  MEMORY_LIMIT_EXCEEDED: { label: "内存超限", color: "border-orange-500/40 bg-orange-500/10 text-orange-700", icon: XCircle },
  RUNTIME_ERROR: { label: "运行错误", color: "border-red-500/40 bg-red-500/10 text-red-700", icon: XCircle },
  COMPILE_ERROR: { label: "编译错误", color: "border-yellow-600/40 bg-yellow-500/10 text-yellow-800", icon: XCircle },
  SYSTEM_ERROR: { label: "系统错误", color: "border-border/60 bg-muted text-muted-foreground", icon: XCircle },
};

export function SubmissionResult({ submission, isLoading }: SubmissionResultProps) {
  if (!submission && !isLoading) return null;

  const status = submission?.status || 'PENDING';
  const config = statusMap[status] || statusMap.PENDING;
  const Icon = config.icon;
  const visibleCases = submission?.cases ?? [];

  return (
    <Card className="mt-4 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          评测结果
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1 ${config.color}`}>
            <Icon className={`h-4 w-4 ${status === 'JUDGING' ? 'animate-spin' : ''}`} />
            <span className="font-medium">{config.label}</span>
          </div>
          {submission && (
            <div className="text-sm text-muted-foreground space-x-4">
               {submission.score !== undefined && <span>Score: {submission.score}</span>}
               {submission.timeUsed !== undefined && <span>Time: {submission.timeUsed}ms</span>}
               {submission.memoryUsed !== undefined && <span>Memory: {submission.memoryUsed}KB</span>}
            </div>
          )}
        </div>
        {submission?.errorMessage && (
          <pre className="mt-4 max-h-40 overflow-auto rounded border border-red-500/30 bg-red-500/10 p-4 text-xs font-mono text-red-700">
            {submission.errorMessage}
          </pre>
        )}
        {visibleCases.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">测试点详情</div>
            <div className="space-y-2">
              {visibleCases.map((item) => (
                <div key={item.id} className="rounded-md border-2 border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      用例 {item.ordinal ?? "-"}
                      {item.testcase?.title ? ` · ${item.testcase.title}` : ""}
                    </div>
                    <div className="text-muted-foreground">
                      {item.status} · {item.timeMs}ms · {item.memoryMb}MB · score {item.score}
                    </div>
                  </div>
                  {item.checkerMessage ? (
                    <div className="mt-2 text-muted-foreground">{item.checkerMessage}</div>
                  ) : null}
                  {item.inputPreview || item.outputPreview || item.expectedPreview ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {item.inputPreview ? (
                        <div>
                          <div className="mb-1 text-muted-foreground">输入预览</div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background p-2">
                            {item.inputPreview}
                          </pre>
                        </div>
                      ) : null}
                      {item.outputPreview ? (
                        <div>
                          <div className="mb-1 text-muted-foreground">输出预览</div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background p-2">
                            {item.outputPreview}
                          </pre>
                        </div>
                      ) : null}
                      {item.expectedPreview ? (
                        <div>
                          <div className="mb-1 text-muted-foreground">期望预览</div>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background p-2">
                            {item.expectedPreview}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
        {submission?.rawStatus && submission.rawStatus !== submission.status && (
          <div className="mt-2 text-xs text-muted-foreground">
            原始状态：{submission.rawStatus}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
