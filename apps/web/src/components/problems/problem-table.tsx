import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLuoguDifficultyBandByDifficulty } from "@/lib/problem-difficulty"

type ProblemTableItem = {
  id: string
  slug: string
  title: string
  difficulty: number
  tags?: string[]
  totalSubmissions?: number
  passRate?: number
}

type ProblemTableProps = {
  problems: ProblemTableItem[]
  hiddenTags?: Set<string>
  activeTagQuery?: string
  getTagClass: (tag: string) => string
  onTagSelect: (tag: string) => void
}

function isTagMatch(tag: string, tagQuery: string) {
  const normalizedTag = tag.trim().toLowerCase()
  const normalizedQuery = tagQuery.trim().toLowerCase()
  if (!normalizedQuery) return false
  return normalizedTag.includes(normalizedQuery)
}

export function ProblemTable({
  problems,
  hiddenTags,
  activeTagQuery = "",
  getTagClass,
  onTagSelect,
}: ProblemTableProps) {
  const router = useRouter()

  return (
    <div className="space-y-3">
      <div className="surface-panel hidden rounded-[1.45rem] px-5 py-3 text-sm font-semibold text-muted-foreground lg:block">
        <div className="grid grid-cols-[220px_minmax(180px,1fr)_80px_minmax(260px,1.35fr)_100px_90px] items-center gap-4">
          <span>题号</span>
          <span>题目名称</span>
          <span>难度</span>
          <span>题目标签</span>
          <span>总提交</span>
          <span>通过率</span>
        </div>
      </div>
      {problems.map((problem) => {
        const href = `/problems/${problem.slug || problem.id}`
        const difficultyMeta = getLuoguDifficultyBandByDifficulty(problem.difficulty)
        const displayTags = (problem.tags ?? []).filter((tag) => !hiddenTags?.has(tag.trim().toLowerCase()))
        const visibleTags = displayTags.slice(0, 4)
        const hiddenTagCount = Math.max(displayTags.length - visibleTags.length, 0)

        return (
          <Card
            key={problem.id}
            role="link"
            tabIndex={0}
            className="surface-panel cursor-pointer overflow-hidden rounded-[1.6rem] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => router.push(href)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                router.push(href)
              }
            }}
          >
            <CardContent className="px-4 py-4 md:px-5">
              <div className="space-y-4 lg:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex max-w-full items-center rounded-full border-[2px] border-border bg-white px-3 py-2 font-mono text-xs text-muted-foreground shadow-[var(--shadow-sm)]">
                    <span className="truncate">{problem.slug}</span>
                  </span>
                  <span className={cn("text-sm font-semibold", difficultyMeta.textClassName)} title={difficultyMeta.fullLabel}>
                    {difficultyMeta.label}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-foreground">{problem.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleTags.length ? (
                    <>
                      {visibleTags.map((tag) => (
                        <button
                          key={`${problem.id}-${tag}`}
                          type="button"
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            getTagClass(tag),
                            isTagMatch(tag, activeTagQuery) ? "border-primary/50 bg-primary/15 text-primary" : null,
                          )}
                          onClick={(event) => {
                            event.stopPropagation()
                            onTagSelect(tag)
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                      {hiddenTagCount > 0 ? (
                        <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-slate-700">
                          +{hiddenTagCount}
                        </Badge>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">无标签</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-inset rounded-[1.1rem] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">总提交</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{problem.totalSubmissions ?? 0}</p>
                  </div>
                  <div className="surface-inset rounded-[1.1rem] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">通过率</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{Math.round((problem.passRate ?? 0) * 100)}%</p>
                  </div>
                </div>
              </div>

              <div className="hidden min-w-[1000px] grid-cols-[220px_minmax(180px,1fr)_80px_minmax(260px,1.35fr)_100px_90px] items-center gap-4 overflow-x-auto lg:grid">
                <div className="min-w-0">
                  <span className="inline-flex max-w-full items-center rounded-full border-[2px] border-border bg-white px-3 py-2 font-mono text-sm text-muted-foreground shadow-[var(--shadow-sm)]">
                    <span className="truncate">{problem.slug}</span>
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold tracking-tight text-foreground">{problem.title}</p>
                </div>
                <div className="min-w-0">
                  <span className={cn("text-sm font-semibold", difficultyMeta.textClassName)} title={difficultyMeta.fullLabel}>
                    {difficultyMeta.label}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  {visibleTags.length ? (
                    <>
                      {visibleTags.map((tag) => (
                        <button
                          key={`${problem.id}-${tag}`}
                          type="button"
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            getTagClass(tag),
                            isTagMatch(tag, activeTagQuery) ? "border-primary/50 bg-primary/15 text-primary" : null,
                          )}
                          onClick={(event) => {
                            event.stopPropagation()
                            onTagSelect(tag)
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                      {hiddenTagCount > 0 ? (
                        <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-slate-700">
                          +{hiddenTagCount}
                        </Badge>
                      ) : null}
                    </>
                  ) : (
                    <span className="truncate text-sm text-muted-foreground">无标签</span>
                  )}
                </div>
                <div className="text-sm font-medium text-foreground">{problem.totalSubmissions ?? 0}</div>
                <div className="text-sm font-medium text-foreground">{Math.round((problem.passRate ?? 0) * 100)}%</div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
