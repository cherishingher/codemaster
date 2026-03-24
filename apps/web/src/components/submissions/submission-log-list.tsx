import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getSubmissionStatusClass, getSubmissionStatusLabel } from "@/lib/submissions"

type SubmissionLogItem = {
  id: string
  status: string
  rawStatus?: string
  score?: number
  language?: string | null
  timeUsedMs?: number | null
  memoryUsedKb?: number | null
  createdAt: string
  problem: {
    slug: string
    title: string
  }
}

type SubmissionLogListProps = {
  submissions: SubmissionLogItem[]
}

export function SubmissionLogList({ submissions }: SubmissionLogListProps) {
  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="rounded-[1.6rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(227,239,248,0.88))] p-4 shadow-[8px_8px_0_hsl(var(--border))] transition hover:-translate-y-1 hover:shadow-[10px_10px_0_hsl(var(--border))]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/submissions/${submission.id}`}
                  className="rounded-full border-[2px] border-border bg-white px-3 py-1 font-mono text-xs text-muted-foreground shadow-[4px_4px_0_hsl(var(--border))] hover:text-primary"
                >
                  #{submission.id}
                </Link>
                <Badge variant="outline" className={getSubmissionStatusClass(submission.status)}>
                  {getSubmissionStatusLabel(submission.status)}
                </Badge>
                {submission.rawStatus && submission.rawStatus !== submission.status ? (
                  <Badge variant="outline" className="border-border bg-white text-foreground">
                    {submission.rawStatus}
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-1">
                <Link
                  href={`/problems/${submission.problem.slug}`}
                  className="block truncate text-lg font-semibold tracking-tight text-foreground transition hover:text-primary"
                >
                  {submission.problem.title}
                </Link>
                <p className="text-sm text-muted-foreground">{new Date(submission.createdAt).toLocaleString()}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">语言</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{submission.language ?? "-"}</p>
                </div>
                <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">分数</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{submission.score ?? 0}</p>
                </div>
                <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">时间</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{submission.timeUsedMs ?? 0} ms</p>
                </div>
                <div className="rounded-[1.2rem] border-[3px] border-border bg-white px-3 py-3 shadow-[5px_5px_0_hsl(var(--border))]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">内存</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{submission.memoryUsedKb ?? 0} KB</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline">
                <Link href={`/problems/${submission.problem.slug}`}>题目</Link>
              </Button>
              <Button asChild>
                <Link href={`/submissions/${submission.id}`}>详情</Link>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
