import * as React from "react"
import { ChevronLeft, ChevronRight, Loader2, Play, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

type SubmitBarLanguage = {
  label: string
  value: string
}

type SubmitBarProps = {
  languages: SubmitBarLanguage[]
  languageValue: string
  onLanguageChange: (value: string) => void
  statusText: string
  statusPillClass: string
  statusMeta?: string
  isScratch?: boolean
  scratchSidebarCollapsed?: boolean
  onToggleScratchSidebar?: () => void
  onRun: () => void
  onSubmit: () => void
  isRunning?: boolean
  isSubmitting?: boolean
  disableRun?: boolean
  disableSubmit?: boolean
  quickLinks?: React.ReactNode
}

export function SubmitBar({
  languages,
  languageValue,
  onLanguageChange,
  statusText,
  statusPillClass,
  statusMeta,
  isScratch = false,
  scratchSidebarCollapsed = false,
  onToggleScratchSidebar,
  onRun,
  onSubmit,
  isRunning = false,
  isSubmitting = false,
  disableRun = false,
  disableSubmit = false,
  quickLinks,
}: SubmitBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b-[3px] border-border bg-background px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">语言</div>
            <select
              className="focus-ring ui-field h-10 min-w-[11rem] px-3 text-sm text-foreground"
              value={languageValue}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-[1rem] border-[2px] border-border/60 bg-white px-3 py-2 text-xs text-muted-foreground">
            <span>评测</span>
            <span className={`rounded-md border px-2 py-0.5 text-xs ${statusPillClass}`}>{statusText}</span>
            {statusMeta ? <span className="hidden text-muted-foreground lg:inline">{statusMeta}</span> : null}
          </div>
          {quickLinks ? <div className="flex flex-wrap items-center gap-2">{quickLinks}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isScratch && onToggleScratchSidebar ? (
            <Button size="sm" variant="outline" className="h-10 gap-2" onClick={onToggleScratchSidebar}>
              {scratchSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
              {scratchSidebarCollapsed ? "展开题面" : "收起题面"}
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="h-10 gap-2 text-muted-foreground hover:text-foreground"
            onClick={onRun}
            disabled={disableRun}
          >
            <Play className="size-4" />
            {isRunning ? "运行中..." : "运行"}
          </Button>

          <Button size="sm" className="h-10 gap-2" onClick={onSubmit} disabled={disableSubmit}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            提交
          </Button>
        </div>
      </div>
      {isScratch ? (
        <div className="text-xs text-muted-foreground">
          Scratch 题支持收起题面，全宽查看工作区；上传 `.sb3` 或 `project.json` 后直接提交评测。
        </div>
      ) : null}
    </div>
  )
}
