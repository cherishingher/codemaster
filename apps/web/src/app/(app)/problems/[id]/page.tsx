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
import { Loader2, Play, Send } from "lucide-react"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Badge } from "@/components/ui/badge"
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

function getSubmissionStatusLabel(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "已通过"
    case "PARTIAL":
      return "部分通过"
    case "WRONG_ANSWER":
      return "答案错误"
    case "TIME_LIMIT_EXCEEDED":
      return "超时"
    case "MEMORY_LIMIT_EXCEEDED":
      return "超内存"
    case "RUNTIME_ERROR":
      return "运行错误"
    case "COMPILE_ERROR":
      return "编译错误"
    case "PENDING":
      return "等待中"
    case "JUDGING":
      return "评测中"
    default:
      return status
  }
}

function getSubmissionStatusClass(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    case "PARTIAL":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300"
    case "PENDING":
    case "JUDGING":
      return "border-blue-500/40 bg-blue-500/10 text-blue-300"
    case "COMPILE_ERROR":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
    default:
      return "border-red-500/40 bg-red-500/10 text-red-300"
  }
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
  const [scratchFileName, setScratchFileName] = React.useState("")
  const [toastPos, setToastPos] = React.useState({ x: 0, y: 0 })
  const [isDraggingToast, setIsDraggingToast] = React.useState(false)
  const dragOffsetRef = React.useRef({ x: 0, y: 0 })
  const problemPaneRef = React.useRef<HTMLDivElement | null>(null)

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
  const statementMarkdown = problem?.statementMd?.trim() || ""
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
      return "border-zinc-700/80 bg-zinc-800/60 text-zinc-300"
    }
    const status = submission?.status ?? (submissionLoading ? "JUDGING" : "PENDING")
    switch (status) {
      case "ACCEPTED":
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      case "PARTIAL":
        return "border-amber-500/40 bg-amber-500/10 text-amber-300"
      case "WRONG_ANSWER":
      case "RUNTIME_ERROR":
        return "border-red-500/40 bg-red-500/10 text-red-300"
      case "COMPILE_ERROR":
        return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
      case "TIME_LIMIT_EXCEEDED":
      case "MEMORY_LIMIT_EXCEEDED":
        return "border-orange-500/40 bg-orange-500/10 text-orange-300"
      case "SYSTEM_ERROR":
        return "border-zinc-600/60 bg-zinc-700/40 text-zinc-200"
      case "PENDING":
      case "JUDGING":
      default:
        return "border-blue-500/40 bg-blue-500/10 text-blue-300"
    }
  }, [submissionId, submission?.status, submissionLoading])

  const getTagClass = React.useCallback((tag: string) => {
    const normalized = tag.toLowerCase()
    if (normalized.includes("scratch") && (normalized.includes("必") || normalized.includes("must"))) {
      return "bg-red-500/10 text-red-300 border-red-500/30"
    }
    if (normalized.includes("scratch")) {
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
    }
    return "bg-zinc-800/70 text-zinc-200 border-zinc-700/60"
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
  const isScratch =
    language.judgeMode === "scratch" || language.value.startsWith("scratch")

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

  const errorStatus = error instanceof ApiError ? error.status : null
  if (!id) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-200">
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
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-200">
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
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
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
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-3.5rem)] md:min-h-0 md:flex-row md:overflow-hidden">
      {/* Problem Description Side */}
      <div
        ref={problemPaneRef}
        className={`flex-1 border-r bg-zinc-900/50 p-6 md:min-h-0 md:overflow-y-auto md:overscroll-contain ${
          isScratch ? "md:w-[15%]" : "md:w-1/2"
        }`}
      >
        <div className="mb-4">
           <Breadcrumbs items={[
             { label: "题库", href: "/problems" },
             { label: problem?.title || "题目详情" }
           ]} />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{problem?.title ?? "加载中..."}</h1>
          {problem?.visibility && problem.visibility !== "public" ? (
            <span className="rounded-md border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300">
              未公开
            </span>
          ) : null}
        </div>
        {problem?.tags?.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {problem.tags.map((tag) => (
              <Badge key={`${problem.id}-${tag}`} variant="outline" className={getTagClass(tag)}>
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {limitText ? (
          <div className="mb-4 text-xs text-muted-foreground">{limitText}</div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            题目不存在、未公开，或加载失败。
          </div>
        ) : null}
        {isLoading && !problem ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : null}
        {statementHeadings.length > 0 ? (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-100">目录</div>
            <div className="space-y-1">
              {statementHeadings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  aria-current={activeHeadingId === heading.id ? "location" : undefined}
                  className={cn(
                    "block rounded px-2 py-1 text-sm transition-colors",
                    activeHeadingId === heading.id
                      ? "bg-emerald-500/10 text-emerald-200"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  )}
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                >
                  {heading.text}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {statementMarkdown ? (
          <ProblemMarkdown markdown={statementMarkdown} />
        ) : (
          <ProblemRichText content={problem?.statement} />
        )}
        {problem?.inputFormat ? (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-zinc-200">输入格式</div>
            <ProblemRichText content={problem.inputFormat} />
          </div>
        ) : null}
        {problem?.outputFormat ? (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-zinc-200">输出格式</div>
            <ProblemRichText content={problem.outputFormat} />
          </div>
        ) : null}
        {problem?.constraints ? (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-zinc-200">约束</div>
            <ProblemRichText content={problem.constraints} />
          </div>
        ) : null}
        {samples.length ? (
          <div className="mt-6 space-y-4">
            <div className="text-sm font-semibold text-zinc-200">样例</div>
            {samples.map((s, idx) => (
              <div key={`${idx}-${s.input ?? ""}`} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="mb-2 text-xs text-zinc-400">样例 {idx + 1}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs text-zinc-500">输入</div>
                    <pre className="whitespace-pre-wrap text-xs text-zinc-200">{s.input ?? ""}</pre>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-zinc-500">输出</div>
                    <pre className="whitespace-pre-wrap text-xs text-zinc-200">{s.output ?? ""}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {problem?.notes ? (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-zinc-200">备注</div>
            <ProblemRichText content={problem.notes} />
          </div>
        ) : null}
        {problem?.hints ? (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-zinc-200">提示</div>
            <ProblemRichText content={problem.hints} />
          </div>
        ) : null}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-zinc-100">该题最近提交</div>
              <div className="text-xs text-zinc-500">
                直接读取当前用户在该题上的最新 5 条提交记录。
              </div>
            </div>
            {problem?.slug ? (
              <Link
                href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}
                className="text-xs font-medium text-sky-300 hover:text-sky-200"
              >
                查看全部
              </Link>
            ) : null}
          </div>
          {authLoading ? (
            <div className="text-sm text-zinc-500">正在检查登录状态...</div>
          ) : !user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="text-sm text-zinc-400">登录后可查看自己在这道题上的提交历史。</div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/login">去登录</Link>
              </Button>
            </div>
          ) : recentSubmissionsLoading ? (
            <div className="text-sm text-zinc-500">加载最近提交中...</div>
          ) : recentSubmissions.length === 0 ? (
            <div className="text-sm text-zinc-500">你还没有在这道题上提交过代码。</div>
          ) : (
            <div className="space-y-2">
              {recentSubmissions.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between ${
                    submissionId === item.id
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-zinc-800 bg-zinc-900/60"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/submissions/${item.id}`}
                        className="text-sm font-medium text-zinc-100 hover:underline"
                      >
                        #{item.id}
                      </Link>
                      <Badge variant="outline" className={getSubmissionStatusClass(item.status)}>
                        {getSubmissionStatusLabel(item.status)}
                      </Badge>
                      {item.rawStatus && item.rawStatus !== item.status ? (
                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                          {item.rawStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>语言 {item.language ?? "-"}</span>
                      <span>分数 {item.score ?? 0}</span>
                      <span>时间 {item.timeUsedMs ?? 0} ms</span>
                      <span>内存 {item.memoryUsedKb ?? 0} KB</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {!isScratch ? (
                      <button
                        type="button"
                        onClick={() => handleSelectSubmission(item.id)}
                        className={`rounded-md px-2 py-1 text-xs ${
                          submissionId === item.id
                            ? "bg-emerald-500/10 text-emerald-200"
                            : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                        }`}
                      >
                        {submissionId === item.id ? "当前查看" : "在当前页查看"}
                      </button>
                    ) : null}
                    <Link href={`/submissions/${item.id}`} className="text-sky-300 hover:text-sky-200">
                      详情
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Code Editor Side */}
      <div
        className={`flex min-w-0 flex-col border-l border-zinc-800 bg-zinc-950 md:min-h-0 md:overflow-hidden ${
          isScratch ? "md:w-[85%]" : "md:w-1/2"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-zinc-400">语言</div>
              <select
                className="h-7 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
                value={language.value}
                    onChange={(e) => {
                  const next =
                    availableLanguages.find((item) => item.value === e.target.value) ??
                    availableLanguages[0]
                  if (!next) return
                  const nextIsScratch =
                    next.judgeMode === "scratch" || next.value.startsWith("scratch")
                  const currentIsScratch = isScratch
                  setLanguageValue(next.value)
                  if (!nextIsScratch || !currentIsScratch) {
                    setCode(next.template)
                    setCodeTouched(false)
                  }
                }}
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-400">
              <span>评测</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs ${statusPillClass}`}>
                {statusText}
              </span>
              {statusMeta ? (
                <span className="hidden text-zinc-400 sm:inline">{statusMeta}</span>
              ) : null}
              {submissionId ? (
                <button
                  type="button"
                  onClick={handleScrollToResult}
                  className="rounded-md px-2 py-0.5 text-[11px] text-emerald-300 hover:text-emerald-200"
                >
                  查看结果
                </button>
              ) : null}
              {problem?.slug ? (
                <Link
                  href={`/submissions?problemSlug=${encodeURIComponent(problem.slug)}`}
                  className="rounded-md px-2 py-0.5 text-[11px] text-sky-300 hover:text-sky-200"
                >
                  该题提交
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-2 text-zinc-400 hover:text-zinc-100"
              onClick={handleRun}
              disabled={isRunning || isScratch}
            >
              <Play className="h-4 w-4" />
              {isRunning ? "运行中..." : "运行"}
            </Button>
            <Button 
              size="sm" 
              className="h-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" 
              onClick={handleSubmit} 
              disabled={isSubmitting || Boolean(submissionId && !isFinished && !submission)}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              提交
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
          {isScratch ? (
            <div className="flex h-[95vh] min-h-[700px] flex-col gap-3">
              <div className="flex-1 overflow-hidden rounded-md border border-zinc-800 bg-black">
                <iframe
                  title="Scratch"
                  src={graphicalUrl}
                  className="h-full w-full"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <input
                  type="file"
                  accept=".sb3,application/json"
                  onChange={handleScratchFileChange}
                  className="text-xs"
                />
                {scratchFileName ? (
                  <span className="truncate text-zinc-300">
                    已选择：{scratchFileName}
                  </span>
                ) : (
                  <span className="text-zinc-500">请选择 .sb3 或 project.json</span>
                )}
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
              <div className="text-[11px] text-zinc-500">
                提交时会使用你上传的 Scratch 文件作为评测内容。
              </div>
            </div>
          ) : (
            <div className="h-[60vh] min-h-[420px]">
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
            <div className="border-t border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-zinc-200">运行测试</div>
                <div className="text-xs text-zinc-400">
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
                  <div className="mb-1 text-xs text-zinc-500">输入</div>
                  <textarea
                    className="h-28 w-full rounded-md border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-100"
                    placeholder="在这里输入测试数据"
                    value={runInput}
                    onChange={(e) => setRunInput(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-500">输出</div>
                  <div className="h-28 w-full overflow-auto rounded-md border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-100">
                    <pre className="whitespace-pre-wrap">{runOutput || "（暂无输出）"}</pre>
                  </div>
                </div>
              </div>
              {runError ? (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  {runError}
                </pre>
              ) : null}
              {runWarning ? (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
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
            <div ref={resultRef} className="border-t border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                <span>Submission ID: {submissionId || "等待生成..."}</span>
                {submissionId ? (
                  <Link href={`/submissions/${submissionId}`} className="text-emerald-400 hover:underline">
                    查看完整提交详情
                  </Link>
                ) : null}
              </div>
              {isError ? (
                <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  获取评测结果失败，请刷新重试或稍后再看。
                </div>
              ) : null}
              <SubmissionResult submission={submission} isLoading={submissionLoading || !isFinished} />
              {!submission && !submissionLoading && !isError ? (
                <div className="mt-2 text-xs text-zinc-400">正在等待评测结果...</div>
              ) : null}
              <details className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
                <summary className="cursor-pointer select-none text-zinc-400">
                  调试信息
                </summary>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div>当前状态: {submission?.status ?? "无"}</div>
                  <div>是否加载中: {submissionLoading ? "是" : "否"}</div>
                  <div>是否完成: {isFinished ? "是" : "否"}</div>
                  <div>最近更新时间: {lastUpdateAt ? lastUpdateAt.toLocaleTimeString() : "无"}</div>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-zinc-400">
                  {submission ? JSON.stringify(submission, null, 2) : "暂无数据"}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
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
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-200 shadow-lg backdrop-blur">
          <span className={`rounded-md border px-2 py-0.5 text-[11px] ${statusPillClass}`}>
            {statusText}
          </span>
          {statusMeta ? (
            <span className="hidden text-[11px] text-zinc-400 sm:inline">{statusMeta}</span>
          ) : null}
          <button
            type="button"
            onClick={handleScrollToResult}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
          >
            查看结果
          </button>
        </div>
      </div>
    ) : null}
    </>
  )
}
