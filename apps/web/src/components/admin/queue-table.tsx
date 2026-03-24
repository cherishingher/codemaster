import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/patterns/status-badge"

type QueueTableRow = {
  id: string
  label: string
  count: number
  note: string
  href: string
}

type QueueTableProps = {
  title?: string
  rows: QueueTableRow[]
}

export function QueueTable({ title = "待处理队列", rows }: QueueTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <StatusBadge tone={rows.some((row) => row.count > 0) ? "warning" : "success"}>
          {rows.some((row) => row.count > 0) ? "待处理" : "已清空"}
        </StatusBadge>
      </div>
      <div className="overflow-hidden rounded-[1.35rem] border-[2px] border-border bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_90px_minmax(0,1.2fr)_88px] gap-3 border-b-[2px] border-border bg-secondary/45 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>队列</span>
          <span>数量</span>
          <span>说明</span>
          <span>动作</span>
        </div>
        <div className="divide-y-[2px] divide-border/70">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_90px_minmax(0,1.2fr)_88px] md:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground md:hidden">{row.note}</p>
              </div>
              <div className="text-sm font-semibold text-foreground">{row.count}</div>
              <div className="hidden text-sm text-muted-foreground md:block">{row.note}</div>
              <div>
                <Button asChild size="sm" variant="outline" className="w-full md:w-auto">
                  <Link href={row.href}>查看</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
