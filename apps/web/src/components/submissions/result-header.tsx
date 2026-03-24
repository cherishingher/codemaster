import * as React from "react"
import Link from "next/link"
import { ArrowRight, RotateCcw } from "lucide-react"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"

type ResultHeaderProps = {
  title: string
  submissionId: string
  createdAt: string
  finishedAt: string
  statusLabel: string
  resultTone: "success" | "warning" | "danger" | "info" | "muted"
  language?: string | null
  judgeBackend?: string | null
  backToProblemHref: string
}

export function ResultHeader({
  title,
  submissionId,
  createdAt,
  finishedAt,
  statusLabel,
  resultTone,
  language,
  judgeBackend,
  backToProblemHref,
}: ResultHeaderProps) {
  return (
    <PageHeader
      eyebrow="Result Header"
      title={title}
      description="把评测结果、资源消耗、测试点明细和下一步建议收在同一屏里，避免只看到状态码不知道怎么改。"
      meta={
        <>
          <span>提交编号</span>
          <span>{submissionId}</span>
          <span>·</span>
          <span>提交时间 {createdAt}</span>
          <span>·</span>
          <span>完成时间 {finishedAt}</span>
        </>
      }
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={backToProblemHref}>
              返回题目
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/submissions">
              提交列表
              <RotateCcw className="size-4" />
            </Link>
          </Button>
        </div>
      }
      aside={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">评测结果</p>
            <div className="mt-2">
              <StatusBadge tone={resultTone} className="text-sm font-semibold">
                {statusLabel}
              </StatusBadge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">语言</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{language ?? "-"}</p>
            </div>
            <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">评测后端</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{judgeBackend ?? "-"}</p>
            </div>
          </div>
        </div>
      }
    />
  )
}
