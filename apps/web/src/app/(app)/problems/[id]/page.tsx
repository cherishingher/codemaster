"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { api, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/problems/code-editor"
import {
  ProblemMarkdown,
  ProblemRichText,
  extractMarkdownHeadings,
} from "@/components/problems/problem-markdown"
import { SubmissionResult } from "@/components/problems/submission-result"
import { useSubmission } from "@/lib/hooks/use-submission"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { AiTutorPanel } from "@/components/ai/ai-tutor-panel"
import { ProblemSolutionsPanel } from "@/components/solutions/problem-solutions-panel"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { ProblemTabs } from "@/components/problems/problem-tabs"
import { SubmitBar } from "@/components/problems/submit-bar"
import {
  getSubmissionStatusClass,
  getSubmissionStatusLabel,
} from "@/lib/submissions"
import { cn } from "@/lib/utils"

type ProblemDetail = {
  id: string
  slug?: string
  title: string
  difficulty?: number | null
  status?: number | null
  source?: string | null
  visibility?: string | null
  tags?: string[]
  version?: number | null
  statement?: string | null
  statementMd?: string | null
  constraints?: string | null
  hints?: string | null
  inputFormat?: string | null
  outputFormat?: string | null
  samples?: Array<{ input?: string; output?: string }> | null
  notes?: string | null
  timeLimitMs?: number | null
  memoryLimitMb?: number | null
  judgeConfigs?: Array<{
    id?: string
    language: string
    languageId?: number | null
    judgeMode?: string | null
    templateCode?: string | null
    isDefault?: boolean
    sortOrder?: number | null
  }>
}

type SubmitResponse = {
  submissionId?: string
  status?: string
}

type SubmissionListResponse = {
  data: Array<{
    id: string
    status: string
    rawStatus?: string
    score?: number
    language?: string | null
    timeUsedMs?: number | null
    memoryUsedKb?: number | null
    createdAt: string
    problem: {
      id: string
      slug: string
      title: string
    }
  }>
}

type EditorLanguageOption = {
  label: string
  value: string
  editor: string
  template: string
  judgeMode: string
  isDefault: boolean
}

const DEFAULT_LANGUAGE_OPTIONS: EditorLanguageOption[] = [
  {
    label: "C++17",
    value: "cpp17",
    editor: "cpp",
    judgeMode: "standard",
    isDefault: true,
    template: `#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  return 0;
}
`,
  },
  {
    label: "C++14",
    value: "cpp14",
    editor: "cpp",
    judgeMode: "standard",
    isDefault: false,
    template: `#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  return 0;
}
`,
  },
  {
    label: "C++11",
    value: "cpp11",
    editor: "cpp",
    judgeMode: "standard",
    isDefault: false,
    template: `#include <iostream>
#include <vector>
#include <algorithm>
#include <string>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  return 0;
}
`,
  },
  {
    label: "Python",
    value: "python",
    editor: "python",
    judgeMode: "standard",
    isDefault: false,
    template: `def main():
    pass


if __name__ == "__main__":
    main()
`,
  },
  {
    label: "Scratch（可选）",
    value: "scratch-optional",
    editor: "json",
    judgeMode: "scratch",
    isDefault: false,
    template: "",
  },
  {
    label: "Scratch（必做）",
    value: "scratch-must",
    editor: "json",
    judgeMode: "scratch",
    isDefault: false,
    template: "",
  },
]

const LANGUAGE_LABELS: Record<string, string> = {
  cpp17: "C++17",
  cpp14: "C++14",
  cpp11: "C++11",
  python: "Python",
  py: "Python",
  "scratch-optional": "Scratch（可选）",
  "scratch-must": "Scratch（必做）",
}

function guessEditorLanguage(language: string) {
  const normalized = language.toLowerCase()
  if (normalized.includes("python") || normalized === "py") return "python"
  if (normalized.includes("scratch") || normalized === "sb3") return "json"
  return "cpp"
}

function buildLanguageOption(config: NonNullable<ProblemDetail["judgeConfigs"]>[number]): EditorLanguageOption {
  const preset = DEFAULT_LANGUAGE_OPTIONS.find((item) => item.value === config.language)
  return {
    label: LANGUAGE_LABELS[config.language] ?? config.language,
    value: config.language,
    editor: preset?.editor ?? guessEditorLanguage(config.language),
    template: config.templateCode ?? preset?.template ?? "",
    judgeMode: config.judgeMode ?? preset?.judgeMode ?? "standard",
    isDefault: Boolean(config.isDefault),
  }
}

const graphicalUrl =
  process.env.NEXT_PUBLIC_GRAPHICAL_URL || "/graphical/index.html"
const SCRATCH_WORKSPACE_MIN_WIDTH = 1024
const SCRATCH_WORKSPACE_HEIGHT = 640
const SCRATCH_WORKSPACE_MAX_WIDTH = 1800

function isHiddenProblemTag(tag: string) {
  const normalized = tag.trim().toLowerCase()
  return normalized === "scratch-必做" || normalized === "scratch-可选"
}

export default function ProblemDetailPage() {
  const params = useParams()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const { user, loading: authLoading } = useAuth()

  // Fetch problem (mock fallback)
  const { data: problem, error, isLoading } = useSWR<ProblemDetail>(
    id ? `/problems/${id}` : null,
    id ? (() => api.problems.get(id) as Promise<ProblemDetail>) : null
  )

  const [languageValue, setLanguageValue] = React.useState(DEFAULT_LANGUAGE_OPTIONS[0].value)
  const [code, setCode] = React.useState(DEFAULT_LANGUAGE_OPTIONS[0].template)
  const [codeTouched, setCodeTouched] = React.useState(false)
  const [submissionId, setSubmissionId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [showRunPanel, setShowRunPanel] = React.useState(false)
  const [runInput, setRunInput] = React.useState("")
  const [runOutput, setRunOutput] = React.useState("")
  const [runError, setRunError] = React.useState("")
  const [runWarning, setRunWarning] = React.useState("")
  const [runMeta, setRunMeta] = React.useState<{
    exitCode?: number | null
    durationMs?: number
    timedOut?: boolean
    phase?: string
  } | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [scratchSidebarCollapsed, setScratchSidebarCollapsed] = React.useState(false)
  const [scratchViewportHeight, setScratchViewportHeight] = React.useState<number | null>(null)
  const [scratchScale, setScratchScale] = React.useState(1)
  const [scratchWorkspaceWidth, setScratchWorkspaceWidth] = React.useState(
    SCRATCH_WORKSPACE_MIN_WIDTH
  )
  const [scratchFileName, setScratchFileName] = React.useState("")
  const [showScratchRecentModal, setShowScratchRecentModal] = React.useState(false)
  const [problemTab, setProblemTab] = React.useState<"statement" | "discussion" | "tips">("statement")
  const [toastPos, setToastPos] = React.useState({ x: 0, y: 0 })
  const [isDraggingToast, setIsDraggingToast] = React.useState(false)
  const dragOffsetRef = React.useRef({ x: 0, y: 0 })
  const problemPaneRef = React.useRef<HTMLDivElement | null>(null)
  const workspaceViewportRef = React.useRef<HTMLDivElement | null>(null)
  const scratchViewportRef = React.useRef<HTMLDivElement | null>(null)

  const recentSubmissionsKey =
    user && problem?.slug
      ? ["/submissions", problem.slug, submissionId ?? "none"]
      : null
  const {
    data: recentSubmissionsResponse,
    isLoading: recentSubmissionsLoading,
  } = useSWR<SubmissionListResponse>(
    recentSubmissionsKey,
    () =>
      api.submissions.list<SubmissionListResponse>({
        problemSlug: problem!.slug!,
        limit: "5",
      })
  )

  const availableLanguages = React.useMemo(() => {
    if (problem?.judgeConfigs?.length) {
      return problem.judgeConfigs.map(buildLanguageOption)
    }
    return DEFAULT_LANGUAGE_OPTIONS
  }, [problem?.judgeConfigs])
  const recentSubmissions = recentSubmissionsResponse?.data ?? []

  const language =
    availableLanguages.find((item) => item.value === languageValue) ??
    availableLanguages[0] ??
    DEFAULT_LANGUAGE_OPTIONS[0]

  // Poll submission status
  const storageKey = React.useMemo(
    () => (id ? `cm:lastSubmission:${id}` : ""),
    [id]
  )

  React.useEffect(() => {
    if (!id || !storageKey) return
    if (submissionId) return
    const stored = sessionStorage.getItem(storageKey)
    if (stored) setSubmissionId(stored)
  }, [id, storageKey, submissionId])

  React.useEffect(() => {
    const defaultOption =
      availableLanguages.find((item) => item.isDefault) ?? availableLanguages[0]
    if (!defaultOption) return

    const currentOption = availableLanguages.find((item) => item.value === languageValue)
    if (!currentOption) {
      setLanguageValue(defaultOption.value)
      if (!codeTouched) {
        setCode(defaultOption.template)
      }
      return
    }

    if (!codeTouched && !code.trim()) {
      setCode(currentOption.template)
    }
  }, [availableLanguages, code, codeTouched, languageValue])

  const { submission, isFinished, isLoading: submissionLoading, isError } = useSubmission(submissionId)
  const [lastUpdateAt, setLastUpdateAt] = React.useState<Date | null>(null)
  const resultRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (submission || isError) {
      setLastUpdateAt(new Date())
    }
  }, [submission, isError])

  // Handle Submit
  const handleSubmit = async () => {
    if (!id) return
    if (!code.trim()) {
      toast.error(isScratch ? "请先导入 Scratch 项目文件" : "请先输入代码")
      return
    }
    setIsSubmitting(true)
    setSubmissionId(null) // Clear previous result
    try {
      const res = (await api.problems.submit(id, code, language.value)) as SubmitResponse
      if (res && res.submissionId) {
        setSubmissionId(res.submissionId)
        if (storageKey) {
          sessionStorage.setItem(storageKey, res.submissionId)
        }
        toast.success("提交成功，正在评测...")
      } else {
        toast.error("提交失败: 未返回 Submission ID")
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message)
      } else {
        toast.error("提交失败")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const samples = Array.isArray(problem?.samples) ? problem?.samples : []
  const isScratchMode =
    language.judgeMode === "scratch" || language.value.startsWith("scratch")
  const statementMarkdown =
    problem?.statementMd?.trim() || (isScratchMode ? problem?.statement?.trim() || "" : "")
  const statementHeadings = React.useMemo(
    () => (statementMarkdown ? extractMarkdownHeadings(statementMarkdown) : []),
    [statementMarkdown]
  )
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null)
  const limitText =
    problem?.timeLimitMs || problem?.memoryLimitMb
      ? `时间 ${problem?.timeLimitMs ?? "-"} ms · 内存 ${problem?.memoryLimitMb ?? "-"} MB`
      : ""

  React.useEffect(() => {
    setActiveHeadingId(statementHeadings[0]?.id ?? null)
  }, [statementHeadings])

  React.useEffect(() => {
    if (statementHeadings.length === 0) return

    let rafId = 0
    const updateActiveHeading = () => {
      const container = problemPaneRef.current
      const containerRect = container?.getBoundingClientRect()
      const useContainerScroll =
        !!container && container.scrollHeight > container.clientHeight + 1
      let candidate = statementHeadings[0]?.id ?? null

      for (const heading of statementHeadings) {
        const element = document.getElementById(heading.id)
        if (!element) continue

        const top = useContainerScroll && containerRect
          ? element.getBoundingClientRect().top - containerRect.top
          : element.getBoundingClientRect().top

        if (top <= 96) {
          candidate = heading.id
        } else {
          break
        }
      }

      setActiveHeadingId((current) => (current === candidate ? current : candidate))
    }

    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(updateActiveHeading)
    }

    scheduleUpdate()
    const container = problemPaneRef.current
    container?.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      container?.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [statementHeadings])

  const statusText = React.useMemo(() => {
    if (!submissionId) return "暂无提交"
    if (submissionLoading && !submission) return "评测中"
    switch (submission?.status) {
      case "ACCEPTED":
        return "正确"
      case "PARTIAL":
        return "部分正确"
      case "WRONG_ANSWER":
        return "错误"
      case "TIME_LIMIT_EXCEEDED":
        return "超时"
      case "MEMORY_LIMIT_EXCEEDED":
        return "超内存"
      case "RUNTIME_ERROR":
        return "运行错误"
      case "COMPILE_ERROR":
        return "编译错误"
      case "SYSTEM_ERROR":
        return "系统错误"
      case "PENDING":
      case "JUDGING":
        return "评测中"
      default:
        return submission?.status ?? "评测中"
    }
  }, [submissionId, submissionLoading, submission])

  const statusPillClass = React.useMemo(() => {
    if (!submissionId) {
      return "border-border/60 bg-muted text-muted-foreground"
    }
    const status = submission?.status ?? (submissionLoading ? "JUDGING" : "PENDING")
    switch (status) {
      case "ACCEPTED":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      case "PARTIAL":
        return "border-amber-500/40 bg-amber-500/10 text-amber-700"
      case "WRONG_ANSWER":
      case "RUNTIME_ERROR":
        return "border-red-500/40 bg-red-500/10 text-red-700"
      case "COMPILE_ERROR":
        return "border-yellow-600/40 bg-yellow-500/10 text-yellow-800"
      case "TIME_LIMIT_EXCEEDED":
      case "MEMORY_LIMIT_EXCEEDED":
        return "border-orange-500/40 bg-orange-500/10 text-orange-700"
      case "SYSTEM_ERROR":
        return "border-muted-foreground/30 bg-muted text-muted-foreground"
      case "PENDING":
      case "JUDGING":
      default:
        return "border-blue-500/40 bg-blue-500/10 text-blue-700"
    }
  }, [submissionId, submission?.status, submissionLoading])

  const getTagClass = React.useCallback((tag: string) => {
    const normalized = tag.toLowerCase()
    if (normalized.includes("scratch") && (normalized.includes("必") || normalized.includes("must"))) {
      return "border-red-500/30 bg-red-500/10 text-red-700"
    }
    if (normalized.includes("scratch")) {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    }
    return "border-border/60 bg-secondary/40 text-foreground"
  }, [])

  const statusMeta = React.useMemo(() => {
    if (!submission) return ""
    const parts: string[] = []
    if (submission.score !== undefined) parts.push(`分数 ${submission.score}`)
    if (submission.timeUsed !== undefined) parts.push(`时间 ${submission.timeUsed}ms`)
    if (submission.memoryUsed !== undefined) parts.push(`内存 ${submission.memoryUsed}KB`)
    return parts.join(" · ")
  }, [submission])

  const sampleInput = samples[0]?.input ?? ""
  const isScratch = isScratchMode
  const showProblemPane = !isScratch || !scratchSidebarCollapsed
  const visibleTags = React.useMemo(
    () => (problem?.tags ?? []).filter((tag) => !isHiddenProblemTag(tag)),
    [problem?.tags]
  )

  React.useEffect(() => {
    if (!isScratch) return
    setShowRunPanel(false)
    setRunOutput("")
    setRunError("")
    setRunWarning("")
    setRunMeta(null)
    setScratchFileName("")
  }, [isScratch])

  React.useEffect(() => {
    if (!isScratch) {
      setShowScratchRecentModal(false)
      setScratchSidebarCollapsed(false)
      setScratchViewportHeight(null)
      setScratchScale(1)
      setScratchWorkspaceWidth(SCRATCH_WORKSPACE_MIN_WIDTH)
    }
  }, [isScratch])

  React.useEffect(() => {
    if (!isScratch) return

    const body = document.body
    const html = document.documentElement
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = html.style.overflow

    body.style.overflow = "hidden"
    html.style.overflow = "hidden"

    return () => {
      body.style.overflow = previousBodyOverflow
      html.style.overflow = previousHtmlOverflow
    }
  }, [isScratch])

  React.useEffect(() => {
    if (!isScratch) return

    const updateScratchViewportHeight = () => {
      const workspace = workspaceViewportRef.current
      if (!workspace) return

      const top = workspace.getBoundingClientRect().top
      const nextHeight = Math.max(Math.floor(window.innerHeight - top - 6), 480)
      setScratchViewportHeight((current) => (current === nextHeight ? current : nextHeight))
    }

    updateScratchViewportHeight()

    const header = document.querySelector("header")
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScratchViewportHeight) : null

    if (header && observer) {
      observer.observe(header)
    }

    window.addEventListener("resize", updateScratchViewportHeight)

    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", updateScratchViewportHeight)
    }
  }, [isScratch])

  React.useEffect(() => {
    if (!isScratch) return

    const updateScratchScale = () => {
      const viewport = scratchViewportRef.current
      if (!viewport) return

      const nextScale = Math.max(viewport.clientHeight / SCRATCH_WORKSPACE_HEIGHT, 0.1)
      const preferredWorkspaceWidth = viewport.clientWidth / nextScale
      const nextWorkspaceWidth = Math.max(
        SCRATCH_WORKSPACE_MIN_WIDTH,
        Math.min(Math.round(preferredWorkspaceWidth), SCRATCH_WORKSPACE_MAX_WIDTH)
      )

      setScratchScale((current) =>
        Math.abs(current - nextScale) < 0.01 ? current : nextScale
      )
      setScratchWorkspaceWidth((current) =>
        current === nextWorkspaceWidth ? current : nextWorkspaceWidth
      )
    }

    updateScratchScale()

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScratchScale) : null

    if (scratchViewportRef.current && observer) {
      observer.observe(scratchViewportRef.current)
    }

    window.addEventListener("resize", updateScratchScale)

    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", updateScratchScale)
    }
  }, [isScratch, scratchSidebarCollapsed])

  React.useEffect(() => {
    if (!showScratchRecentModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowScratchRecentModal(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showScratchRecentModal])

  React.useEffect(() => {
    if (!submissionId) return
    setToastPos({ x: 0, y: 0 })
  }, [submissionId])

  React.useEffect(() => {
    if (!isDraggingToast) return
    const onMove = (event: PointerEvent) => {
      setToastPos({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      })
    }
    const onUp = () => setIsDraggingToast(false)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [isDraggingToast])

  const handleScratchFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    setScratchFileName(file.name)
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const text = await file.text()
        setCode(text)
        setCodeTouched(true)
        toast.success("已载入 project.json")
        return
      }
      if (!file.name.toLowerCase().endsWith(".sb3")) {
        toast.error("请上传 .sb3 或 project.json 文件")
        return
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"))
        reader.readAsDataURL(file)
      })
      setCode(dataUrl)
      setCodeTouched(true)
      toast.success("已载入 .sb3 项目")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "读取文件失败")
    }
  }

  const handleScrollToResult = React.useCallback(() => {
    if (!resultRef.current) return
    resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleSelectSubmission = React.useCallback(
    (nextSubmissionId: string) => {
      if (!nextSubmissionId) return
      if (storageKey) {
        sessionStorage.setItem(storageKey, nextSubmissionId)
      }
      setSubmissionId(nextSubmissionId)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleScrollToResult()
        })
      })
    },
    [handleScrollToResult, storageKey]
  )

  const handleRun = async () => {
    if (!code || !id) return
    if (isScratch) {
      toast.info("Scratch 题暂不支持本地运行，请直接提交评测")
      return
    }
    if (!showRunPanel) setShowRunPanel(true)
    if (code.includes("bits/stdc++.h")) {
      toast.warning("macOS 本地运行不支持 <bits/stdc++.h>，请改为标准头文件（如 <iostream>）")
    }
    let input = runInput
    if (!input.trim() && sampleInput) {
      input = sampleInput
      setRunInput(sampleInput)
    }
    if (!input.trim()) {
      toast.error("请先输入运行输入，或使用样例 1")
      return
    }
    setIsRunning(true)
    setRunOutput("")
    setRunError("")
    setRunWarning("")
    setRunMeta(null)
    try {
      const res = await api.problems.run(id, code, language.value, input)
      const payload = res as {
        ok?: boolean
        stdout?: string
        stderr?: string
        exitCode?: number | null
        timedOut?: boolean
        durationMs?: number
        phase?: string
        error?: string
        warning?: string | null
      }
      setRunOutput(payload.stdout ?? "")
      setRunWarning(payload.warning ?? "")
      if (payload.error) {
        setRunError(payload.error)
      } else if (payload.stderr) {
        setRunError(payload.stderr)
      }
      setRunMeta({
        exitCode: payload.exitCode,
        durationMs: payload.durationMs,
        timedOut: payload.timedOut,
        phase: payload.phase,
      })
      if (payload.timedOut) {
        toast.error("运行超时")
      } else if (payload.ok === false && payload.phase === "compile") {
        toast.error("编译失败")
      }
    } catch (err) {
      if (err instanceof Error) {
        setRunError(err.message)
        toast.error(err.message)
      } else {
        setRunError("运行失败")
        toast.error("运行失败")
      }
    } finally {
      setIsRunning(false)
    }
  }

  const recentSubmissionsContent = authLoading ? (
    <div className="text-sm text-muted-foreground">正在检查登录状态...</div>
  ) : !user ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-border/60 bg-muted/40 p-3">
      <div className="text-sm text-muted-foreground">登录后可查看自己在这道题上的提交历史。</div>
      <Button asChild size="sm" variant="secondary">
        <Link href="/login">去登录</Link>
      </Button>
    </div>
  ) : recentSubmissionsLoading ? (
    <div className="text-sm text-muted-foreground">加载最近提交中...</div>
  ) : recentSubmissions.length === 0 ? (
    <div className="text-sm text-muted-foreground">你还没有在这道题上提交过代码。</div>
  ) : (
    <div className={cn("space-y-2", isScratch && "max-h-[56vh] overflow-y-auto pr-1")}>
      {recentSubmissions.map((item) => (
        <div
          key={item.id}
          className={`flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${
            submissionId === item.id
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-border/60 bg-muted/30"
          }`}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                href={`/submissions/${item.id}`}
                className="max-w-full truncate text-sm font-medium text-foreground hover:underline"
              >
                #{item.id}
              </Link>
              <Badge variant="outline" className={getSubmissionStatusClass(item.status)}>
                {getSubmissionStatusLabel(item.status)}
              </Badge>
              {item.rawStatus && item.rawStatus !== item.status ? (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  {item.rawStatus}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>语言 {item.language ?? "-"}</span>
              <span>分数 {item.score ?? 0}</span>
              {!isScratch ? <span>时间 {item.timeUsedMs ?? 0} ms</span> : null}
              {!isScratch ? <span>内存 {item.memoryUsedKb ?? 0} KB</span> : null}
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 text-xs text-muted-foreground",
              isScratch && "justify-between"
            )}
          >
            <span>{new Date(item.createdAt).toLocaleString()}</span>
            {!isScratch ? (
              <button
                type="button"
                onClick={() => handleSelectSubmission(item.id)}
                className={`rounded-md px-2 py-1 text-xs ${
                  submissionId === item.id
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {submissionId === item.id ? "当前查看" : "在当前页查看"}
              </button>
            ) : null}
            <Link href={`/submissions/${item.id}`} className="text-sky-700 hover:text-sky-800">
              详情
            </Link>
          </div>
        </div>
      ))}
    </div>
  )

  const errorStatus = error instanceof ApiError ? error.status : null
  if (!id) {
    return (
      <div className="page-wrap py-12">
        <div className="mx-auto max-w-md rounded-[1.6rem] border-[3px] border-border bg-card p-6 text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          无效的题目地址，请从题库列表进入。
          <div className="mt-4 flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/problems">返回题库</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (errorStatus === 404) {
    return (
      <div className="page-wrap py-12">
        <div className="mx-auto max-w-md rounded-[1.6rem] border-[3px] border-border bg-card p-6 text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          题目不存在或未公开。如果你是管理员，请登录后再查看。
          <div className="mt-4 flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/problems">返回题库</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">去登录</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error && !problem) {
    return (
      <div className="page-wrap py-12">
        <div className="mx-auto max-w-md rounded-[1.6rem] border-[3px] border-red-400/60 bg-red-500/10 p-6 text-sm text-red-700 shadow-[10px_10px_0_hsl(var(--border))]">
          题目加载失败，请稍后重试。
          <div className="mt-4 flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/problems">返回题库</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div
      className={cn(
        isScratch
          ? "mx-auto w-full max-w-[min(100vw-0.5rem,1920px)] px-1 py-1 md:px-2 md:py-2"
          : "page-wrap py-4 md:py-6"
      )}
    >
    {!isScratch ? (
      <div className="mb-4">
        <PageHeader
          eyebrow="Problem Workspace"
          title={problem?.title ?? "题目详情"}
          description="题目详情页统一成 PageTitle + Action Bar + 双栏工作区。题面、讨论和提示分开组织，避免把提问、题解和正文搅在一起。"
          meta={
            <>
              <span>阅读题面</span>
              <span>·</span>
              <span>编码提交</span>
              <span>·</span>
              <span>讨论求助</span>
              <span>·</span>
              <span>提示与题解</span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-3">
              {problem?.slug ? (
                <Button asChild variant="secondary">
                  <Link href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}>查看该题提交</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=question&sort=unsolved`}>提问求助</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=problem_discussion`}>进入讨论</Link>
              </Button>
            </div>
          }
          aside={
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {visibleTags.length ? (
                  visibleTags.map((tag) => (
                    <Badge key={`${problem?.id ?? id}-${tag}`} variant="outline" className={getTagClass(tag)}>
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <StatusBadge>无标签</StatusBadge>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">评测限制</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{limitText ?? "默认限制"}</p>
                </div>
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">当前模式</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{isScratch ? "Scratch" : language.label}</p>
                </div>
              </div>
            </div>
          }
        />
      </div>
    ) : null}
    <div
      ref={workspaceViewportRef}
      className={cn(
        "flex flex-col gap-3 md:min-h-0 md:flex-row md:overflow-hidden",
        isScratch
          ? "min-h-0"
          : "min-h-[calc(100vh-14rem)] md:h-[calc(100vh-18rem)]"
      )}
      style={isScratch && scratchViewportHeight ? { height: `${scratchViewportHeight}px` } : undefined}
    >
      {/* Problem Description Side */}
      {showProblemPane ? (
      <div
        ref={problemPaneRef}
        className={cn(
          "flex-1 rounded-[1.8rem] border-[3px] border-border bg-card shadow-[10px_10px_0_hsl(var(--border))] md:min-h-0 md:overflow-y-auto md:overscroll-contain",
          isScratch
            ? "p-3 md:w-[16rem] md:flex-none md:self-stretch md:px-4 md:py-4 lg:w-[17rem] xl:w-[18rem]"
            : "p-4 md:w-1/2 md:p-5"
        )}
      >
        <div className="mb-3">
           <Breadcrumbs items={[
             { label: "题库", href: "/problems" },
             { label: problem?.title || "题目详情" }
           ]} />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{problem?.title ?? "加载中..."}</h1>
          {problem?.visibility && problem.visibility !== "public" ? (
            <span className="rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-700">
              未公开
            </span>
          ) : null}
        </div>
        {visibleTags.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {visibleTags.map((tag) => (
              <Badge key={`${problem.id}-${tag}`} variant="outline" className={getTagClass(tag)}>
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {limitText ? <div className="mb-3 text-xs text-muted-foreground">{limitText}</div> : null}
        {!isScratch ? (
          <div className="mb-4 rounded-xl border-2 border-border/60 bg-background p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">操作速览</div>
                <div className="text-xs text-muted-foreground">
                  先完成提交，再按需要查看题解、视频解析或专题内容包。
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {problem?.slug ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}>
                      查看该题提交
                    </Link>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=problem_discussion`}>
                    题目讨论
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=question&sort=unsolved`}>
                    提问求助
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="#problem-solutions">题解与视频</a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/products?type=membership">开通 VIP</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/content-packs">内容包专区</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {!isScratch ? (
          <div className="mb-4">
            <ProblemTabs
              value={problemTab}
              onValueChange={setProblemTab}
              questionHref={`/discuss?problemId=${encodeURIComponent(id)}&postType=question&sort=unsolved`}
              discussionHref={`/discuss?problemId=${encodeURIComponent(id)}&postType=problem_discussion`}
            />
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
            题目不存在、未公开，或加载失败。
          </div>
        ) : null}
        {isLoading && !problem ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : null}
        {!isScratch && problemTab === "statement" && statementHeadings.length > 0 ? (
          <div className="mb-4 rounded-xl border-2 border-border/60 bg-background p-3">
            <div className="mb-3 text-sm font-semibold text-foreground">目录</div>
            <div className="space-y-1">
              {statementHeadings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  aria-current={activeHeadingId === heading.id ? "location" : undefined}
                  className={cn(
                    "block rounded px-2 py-1 text-sm transition-colors",
                    activeHeadingId === heading.id
                      ? "bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                >
                  {heading.text}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {(isScratch || problemTab === "statement") ? (
          <>
            {statementMarkdown ? (
              <ProblemMarkdown markdown={statementMarkdown} />
            ) : (
              <ProblemRichText content={problem?.statement} />
            )}
            {problem?.inputFormat ? (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-foreground">输入格式</div>
                {isScratch ? (
                  <ProblemMarkdown markdown={problem.inputFormat} />
                ) : (
                  <ProblemRichText content={problem.inputFormat} />
                )}
              </div>
            ) : null}
            {problem?.outputFormat ? (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-foreground">输出格式</div>
                {isScratch ? (
                  <ProblemMarkdown markdown={problem.outputFormat} />
                ) : (
                  <ProblemRichText content={problem.outputFormat} />
                )}
              </div>
            ) : null}
            {problem?.constraints ? (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-foreground">约束</div>
                {isScratch ? (
                  <ProblemMarkdown markdown={problem.constraints} />
                ) : (
                  <ProblemRichText content={problem.constraints} />
                )}
              </div>
            ) : null}
            {samples.length ? (
              <div className="mt-5 space-y-3">
                <div className="text-sm font-semibold text-foreground">样例</div>
                {samples.map((s, idx) => (
                  <div key={`${idx}-${s.input ?? ""}`} className="rounded-xl border-2 border-border/60 bg-background p-3">
                    <div className="mb-2 text-xs text-muted-foreground">样例 {idx + 1}</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">输入</div>
                        <pre className="whitespace-pre-wrap text-xs text-foreground">{s.input ?? ""}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">输出</div>
                        <pre className="whitespace-pre-wrap text-xs text-foreground">{s.output ?? ""}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {problem?.notes ? (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-foreground">备注</div>
                {isScratch ? (
                  <ProblemMarkdown markdown={problem.notes} />
                ) : (
                  <ProblemRichText content={problem.notes} />
                )}
              </div>
            ) : null}
          </>
        ) : null}
        {!isScratch && problemTab === "discussion" ? (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-border/60 bg-background p-4">
              <div className="text-sm font-semibold text-foreground">讨论入口</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                题目讨论用于交流思路和赛后复盘；提问求助用于结构化说明你已经尝试过什么、现在具体卡在哪里。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=question&sort=unsolved`}>
                    发布求助帖
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/discuss?problemId=${encodeURIComponent(id)}&postType=problem_discussion`}>
                    查看题目讨论
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-xl border-2 border-border/60 bg-background p-4">
              <div className="text-sm font-semibold text-foreground">提问模板提醒</div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                <li>说明你当前的思路、复杂度判断和已经尝试过的修正。</li>
                <li>明确卡点，例如边界、状态设计、样例不一致，而不是只说“不会做”。</li>
                <li>默认不鼓励直接求完整 AC 代码，优先求提示、思路或错误定位。</li>
              </ul>
            </div>
            <div className="rounded-xl border-2 border-border/60 bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">该题最近提交</div>
                  <div className="text-xs text-muted-foreground">先看自己最近几次结果，再去发问会更高效。</div>
                </div>
                {problem?.slug ? (
                  <Link
                    href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    查看全部
                  </Link>
                ) : null}
              </div>
              {recentSubmissionsContent}
            </div>
          </div>
        ) : null}
        {!isScratch && problemTab === "tips" ? (
          <div className="space-y-5">
            {problem?.hints ? (
              <div>
                <div className="mb-2 text-sm font-semibold text-foreground">提示</div>
                <ProblemRichText content={problem.hints} />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border/60 bg-background p-4 text-sm text-muted-foreground">
                当前题目还没有配置文字提示，可以先参考讨论区或最近提交结果。
              </div>
            )}
            <div id="problem-solutions" className="mt-2">
              <ProblemSolutionsPanel problemId={id} />
            </div>
            <div>
              <AiTutorPanel problemId={id} problemTitle={problem?.title ?? null} compact />
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Code Editor Side */}
      <div
        className={cn(
          "flex min-w-0 flex-col rounded-[1.8rem] border-[3px] border-border bg-card shadow-[10px_10px_0_hsl(var(--border))] md:min-h-0 md:overflow-hidden",
          isScratch ? "md:w-0 md:flex-1" : "md:w-1/2"
        )}
      >
        <SubmitBar
          languages={availableLanguages.map((item) => ({ label: item.label, value: item.value }))}
          languageValue={language.value}
          onLanguageChange={(value) => {
            const next = availableLanguages.find((item) => item.value === value) ?? availableLanguages[0]
            if (!next) return
            const nextIsScratch = next.judgeMode === "scratch" || next.value.startsWith("scratch")
            const currentIsScratch = isScratch
            setLanguageValue(next.value)
            if (!nextIsScratch || !currentIsScratch) {
              setCode(next.template)
              setCodeTouched(false)
            }
          }}
          statusText={statusText}
          statusPillClass={statusPillClass}
          statusMeta={statusMeta}
          isScratch={isScratch}
          scratchSidebarCollapsed={scratchSidebarCollapsed}
          onToggleScratchSidebar={() => setScratchSidebarCollapsed((current) => !current)}
          onRun={handleRun}
          onSubmit={handleSubmit}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          disableRun={isRunning || isScratch}
          disableSubmit={isSubmitting || Boolean(submissionId && !isFinished && !submission)}
          quickLinks={
            <>
              {submissionId ? (
                <button
                  type="button"
                  onClick={handleScrollToResult}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
                >
                  查看结果
                </button>
              ) : null}
              {problem?.slug ? (
                <Link
                  href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:text-sky-800"
                >
                  该题提交
                </Link>
              ) : null}
              {isScratch ? (
                <button
                  type="button"
                  onClick={() => setShowScratchRecentModal(true)}
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
                >
                  最近提交
                </button>
              ) : null}
            </>
          }
        />

        <div
          className={cn(
            "flex flex-col md:min-h-0 md:flex-1 md:overscroll-contain",
            isScratch ? "gap-0 p-0 md:overflow-hidden" : "gap-4 p-4 md:overflow-y-auto"
          )}
        >
          {isScratch ? (
            <div className="flex min-h-[68vh] flex-col md:min-h-0 md:flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-[2px] border-border/60 bg-background px-3 py-2 text-xs">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept=".sb3,application/json"
                    onChange={handleScratchFileChange}
                    className="max-w-full text-xs"
                  />
                  {scratchFileName ? (
                    <span className="truncate text-foreground">
                      已选择：{scratchFileName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">请选择 .sb3 或 project.json</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">上传文件后直接提交评测</span>
                  {scratchFileName ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setScratchFileName("")
                        setCode("")
                        setCodeTouched(false)
                      }}
                    >
                      清除
                    </Button>
                  ) : null}
                </div>
              </div>
              <div
                ref={scratchViewportRef}
                className="min-h-0 flex-1 overflow-hidden bg-background"
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden p-1">
                  <div
                    className="shrink-0"
                    style={{
                      width: `${scratchWorkspaceWidth * scratchScale}px`,
                      height: `${SCRATCH_WORKSPACE_HEIGHT * scratchScale}px`,
                    }}
                  >
                    <iframe
                      title="Scratch"
                      src={graphicalUrl}
                      className="block border-0"
                      style={{
                        width: `${scratchWorkspaceWidth}px`,
                        height: `${SCRATCH_WORKSPACE_HEIGHT}px`,
                        transform: `scale(${scratchScale})`,
                        transformOrigin: "top left",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[56vh] min-h-[360px]">
              <CodeEditor
                value={code}
                onChange={(val) => {
                  setCode(val || "")
                  setCodeTouched(true)
                }}
                language={language.editor}
              />
            </div>
          )}

          {(showRunPanel || runOutput || runError) && (
            <div className="rounded-xl border-2 border-border/60 bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">运行测试</div>
                <div className="text-xs text-muted-foreground">
                  {isRunning
                    ? "运行中..."
                    : runMeta?.timedOut
                    ? "运行超时"
                    : runMeta?.phase === "compile"
                    ? "编译失败"
                    : runMeta?.durationMs !== undefined
                    ? `耗时 ${runMeta.durationMs}ms`
                    : "准备就绪"}
                  {runMeta?.exitCode !== undefined && runMeta?.exitCode !== null
                    ? ` · exit ${runMeta.exitCode}`
                    : ""}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">输入</div>
                  <textarea
                    className="h-28 w-full rounded-md border-2 border-border/60 bg-card p-2 text-xs text-foreground"
                    placeholder="在这里输入测试数据"
                    value={runInput}
                    onChange={(e) => setRunInput(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">输出</div>
                  <div className="h-28 w-full overflow-auto rounded-md border-2 border-border/60 bg-card p-2 text-xs text-foreground">
                    <pre className="whitespace-pre-wrap">{runOutput || "（暂无输出）"}</pre>
                  </div>
                </div>
              </div>
              {runError ? (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700">
                  {runError}
                </pre>
              ) : null}
              {runWarning ? (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700">
                  {runWarning}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={handleRun} disabled={isRunning || isScratch}>
                  {isRunning ? "运行中..." : "重新运行"}
                </Button>
                {sampleInput ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRunInput(sampleInput)}
                  >
                    使用样例 1
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRunOutput("")
                    setRunError("")
                    setRunWarning("")
                    setRunMeta(null)
                  }}
                >
                  清空输出
                </Button>
              </div>
            </div>
          )}

          {/* Submission Console */}
          {!isScratch && (submissionId || submission || isSubmitting) && (
            <div ref={resultRef} className="rounded-xl border-2 border-border/60 bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Submission ID: {submissionId || "等待生成..."}</span>
                {submissionId ? (
                  <Link href={`/submissions/${submissionId}`} className="text-emerald-700 hover:underline">
                    查看完整提交详情
                  </Link>
                ) : null}
              </div>
              {isError ? (
                <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700">
                  获取评测结果失败，请刷新重试或稍后再看。
                </div>
              ) : null}
              <SubmissionResult submission={submission} isLoading={submissionLoading || !isFinished} />
              {!submission && !submissionLoading && !isError ? (
                <div className="mt-2 text-xs text-muted-foreground">正在等待评测结果...</div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span>当前状态：{submission?.status ?? "等待结果"}</span>
                <span>结果刷新：{submissionLoading ? "进行中" : isFinished ? "已完成" : "等待中"}</span>
                <span>最近更新：{lastUpdateAt ? lastUpdateAt.toLocaleTimeString() : "暂无"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
    {isScratch && showScratchRecentModal ? (
      <div
        className="fixed inset-0 z-[70] bg-black/35 p-3 md:p-8"
        onClick={() => setShowScratchRecentModal(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="该题最近提交"
          className="mx-auto flex h-full w-full max-w-3xl flex-col rounded-[1.6rem] border-[3px] border-border bg-card shadow-[12px_12px_0_hsl(var(--border))]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b-[3px] border-border px-4 py-3">
            <div>
              <div className="text-base font-semibold text-foreground">该题最近提交</div>
              <div className="text-xs text-muted-foreground">当前用户在本题的最新 5 条提交记录</div>
            </div>
            <div className="flex items-center gap-2">
              {problem?.slug ? (
                <Link
                  href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}
                  className="text-xs font-medium text-sky-700 hover:text-sky-800"
                >
                  查看全部
                </Link>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setShowScratchRecentModal(false)}>
                关闭
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{recentSubmissionsContent}</div>
        </div>
      </div>
    ) : null}
    {submissionId ? (
      <div
        className="fixed bottom-4 right-4 z-50 max-w-[90vw]"
        style={{
          transform: `translate(${toastPos.x}px, ${toastPos.y}px)`,
          touchAction: "none",
          cursor: isDraggingToast ? "grabbing" : "grab",
        }}
        onPointerDown={(event) => {
          setIsDraggingToast(true)
          dragOffsetRef.current = {
            x: event.clientX - toastPos.x,
            y: event.clientY - toastPos.y,
          }
        }}
      >
        <div className="flex items-center gap-2 rounded-full border-2 border-border bg-card px-3 py-2 text-xs text-foreground shadow-[8px_8px_0_hsl(var(--border))]">
          <span className={`rounded-md border px-2 py-0.5 text-[11px] ${statusPillClass}`}>
            {statusText}
          </span>
          {statusMeta ? (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{statusMeta}</span>
          ) : null}
          <button
            type="button"
            onClick={handleScrollToResult}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-500/20"
          >
            查看结果
          </button>
        </div>
      </div>
    ) : null}
    </>
  )
}
