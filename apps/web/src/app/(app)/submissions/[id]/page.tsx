"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
  Target,
  TimerReset,
  XCircle,
} from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { useSubmission } from "@/lib/hooks/use-submission"
import { getSubmissionStatusLabel } from "@/lib/submissions"
import { Button } from "@/components/ui/button"
import { SubmissionResult } from "@/components/problems/submission-result"
import { ErrorState, LoadingState } from "@/components/patterns/state-panel"
import { SectionCard } from "@/components/patterns/section-card"
import { StatCard } from "@/components/patterns/stat-card"
import { ResultHeader } from "@/components/submissions/result-header"
import { TestcaseList } from "@/components/submissions/testcase-list"

function formatMaybeDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "-"
}

function getResultTone(status?: string) {
  switch (status) {
    case "ACCEPTED":
      return "success" as const
    case "PENDING":
    case "JUDGING":
      return "info" as const
    case "PARTIAL":
    case "TIME_LIMIT_EXCEEDED":
    case "MEMORY_LIMIT_EXCEEDED":
      return "warning" as const
    case "WRONG_ANSWER":
    case "RUNTIME_ERROR":
    case "COMPILE_ERROR":
    case "SYSTEM_ERROR":
      return "danger" as const
    default:
      return "muted" as const
  }
}

function getResultIcon(status?: string) {
  switch (status) {
    case "ACCEPTED":
      return CheckCircle2
    case "PENDING":
    case "JUDGING":
      return Clock3
    default:
      return XCircle
  }
}

function buildSuggestions(status?: string) {
  switch (status) {
    case "ACCEPTED":
      return [
        "把这次 AC 的思路补进题解或讨论区，沉淀解题过程。",
        "再看一遍边界条件和复杂度，确认这不是只过样例的幸运提交。",
        "如果这题属于某条训练路径，继续做下一题，保持连续训练。",
      ]
    case "WRONG_ANSWER":
      return [
        "优先对照样例、极小值、极大值和边界情况检查分支。",
        "重点核对输出格式、下标范围和多组输入的处理。",
        "如果还是卡住，去题目讨论区发结构化求助，而不是直接求完整代码。",
      ]
    case "TIME_LIMIT_EXCEEDED":
      return [
        "先确认算法复杂度是否超过题目上限，而不是只盯着常数优化。",
        "检查是否有重复扫描、无效排序或多余拷贝。",
        "必要时对比同题已通过语言版本，定位瓶颈在算法还是实现。",
      ]
    case "MEMORY_LIMIT_EXCEEDED":
      return [
        "检查是否把整张表、整棵树或全部状态都不必要地存下来了。",
        "优先压缩状态数组和临时容器，避免重复副本。",
        "如果是图或 DP，重新估算理论内存占用，确认模型是否合理。",
      ]
    case "COMPILE_ERROR":
      return [
        "先修语法、头文件、命名冲突和类型不匹配，别急着改算法。",
        "如果是语言版本问题，确认当前提交语言和本地代码模板一致。",
        "查看编译输出里的第一条错误，通常它才是根因。",
      ]
    case "RUNTIME_ERROR":
      return [
        "优先检查数组越界、空指针、除零和递归深度。",
        "对照失败测试点，检查输入规模和异常分支处理。",
        "可以先用自定义运行输入复现最小错误场景。",
      ]
    default:
      return [
        "等待评测完成后再看测试点和资源消耗数据。",
        "如果长时间停留在评测中，先确认判题队列和当前比赛流量。",
        "不要重复连点提交，先等当前结果返回。",
      ]
  }
}

function buildNextActions(submissionId: string, problemSlug?: string | null) {
  const actions = [
    { href: "/problems", label: "回到题库" },
    { href: "/submissions", label: "查看全部提交" },
  ]

  if (problemSlug) {
    actions.unshift({ href: `/problems/${problemSlug}`, label: "回到题目" })
  }
  actions.push({ href: `/discuss?postType=question&sort=unsolved`, label: "进入求助区" })
  actions.push({ href: `/submissions/${submissionId}`, label: "刷新本页" })

  return actions
}

export default function SubmissionDetailPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const params = useParams<{ id?: string | string[] }>()
  const submissionId = Array.isArray(params.id) ? params.id[0] : params.id ?? null
  const { submission, isLoading, isError } = useSubmission(submissionId)

  if (loading || !user) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <LoadingState title="正在进入提交结果页" description="正在确认登录状态并加载评测结果。" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <ErrorState
          title="提交结果加载失败"
          description="当前无法读取评测结果。请检查权限或稍后重试。"
          action={
            <Button asChild variant="secondary">
              <Link href="/submissions">返回提交列表</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const resultTone = getResultTone(submission?.status)
  const suggestions = buildSuggestions(submission?.status)
  const nextActions = buildNextActions(submissionId ?? "", submission?.problem?.slug)
  const visibleCases = submission?.cases ?? []

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <ResultHeader
          title={submission?.problem?.title ?? "提交结果详情"}
          submissionId={submissionId ?? "-"}
          createdAt={formatMaybeDate(submission?.createdAt)}
          finishedAt={formatMaybeDate(submission?.finishedAt)}
          statusLabel={submission?.status ? getSubmissionStatusLabel(submission.status) : "等待结果"}
          resultTone={resultTone}
          language={submission?.language}
          judgeBackend={submission?.judgeBackend}
          backToProblemHref={submission?.problem?.slug ? `/problems/${submission.problem.slug}` : "/problems"}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Status"
            value={submission?.status ? getSubmissionStatusLabel(submission.status) : "等待中"}
            description="统一的结果状态文案"
            icon={getResultIcon(submission?.status)}
            tone={resultTone === "success" ? "primary" : resultTone === "warning" ? "warning" : "accent"}
          />
          <StatCard label="Score" value={submission?.score ?? 0} description="本次提交得分" icon={Target} tone="secondary" />
          <StatCard label="Time" value={`${submission?.timeUsed ?? 0} ms`} description="总耗时" icon={Clock3} tone="accent" />
          <StatCard
            label="Memory"
            value={`${submission?.memoryUsed ?? 0} KB`}
            description="峰值内存"
            icon={TimerReset}
            tone="warning"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="space-y-6">
            <SectionCard
              title="评测总览"
              description="先看整体结果，再逐个下钻到测试点、编译输出和运行信息。"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在获取最新评测结果...
                </div>
              ) : null}
              <SubmissionResult submission={submission} isLoading={Boolean(isLoading && !submission)} />
            </SectionCard>

            <SectionCard
              title="测试点明细"
              description="提交后会自动刷新当前页；上方用格子展示每个测试点的状态，下方查看选中测试点的详细预览。"
              action={
                <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                  <span>{visibleCases.length} 个测试点</span>
                  {submission && ["PENDING", "JUDGING"].includes(submission.status) ? (
                    <span className="inline-flex items-center gap-1 text-sky-700">
                      <Loader2 className="size-3.5 animate-spin" />
                      自动刷新中
                    </span>
                  ) : null}
                </div>
              }
            >
              <TestcaseList cases={visibleCases} getTone={getResultTone} />
            </SectionCard>

            <SectionCard title="编译与运行信息" description="把编译输出、运行时元信息和源码并排放置，减少来回切页。">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <div className="surface-inset rounded-[1.5rem] p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">CompileInfo</p>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {submission?.compileInfo
                        ? JSON.stringify(submission.compileInfo, null, 2)
                        : "暂无编译信息"}
                    </pre>
                  </div>
                  <div className="surface-inset rounded-[1.5rem] p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">RuntimeInfo</p>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {submission?.runtimeInfo
                        ? JSON.stringify(submission.runtimeInfo, null, 2)
                        : "暂无运行信息"}
                    </pre>
                  </div>
                </div>
                <div className="surface-inset rounded-[1.5rem] p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>存储 {submission?.sourceCode?.storageType ?? "-"}</span>
                    {submission?.sourceCode?.sourceSize ? <span>大小 {submission.sourceCode.sourceSize} bytes</span> : null}
                    {submission?.sourceCode?.objectKey ? <span>对象 {submission.sourceCode.objectKey}</span> : null}
                  </div>
                  <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-[1.1rem] bg-zinc-950 p-4 text-xs text-zinc-100">
                    {submission?.sourceCode?.source ?? "当前提交未返回内联源码。"}
                  </pre>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="改进建议"
              description="根据当前结果状态给出下一步操作建议，帮助用户形成训练闭环。"
              action={<Sparkles className="size-4 text-primary" />}
            >
              <div className="space-y-3">
                {suggestions.map((item) => (
                  <div key={item} className="surface-inset rounded-[1.35rem] p-4 text-sm leading-7 text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="下一步动作" description="避免用户在结果页停住，给出直接可执行的去向。">
              <div className="grid gap-3">
                {nextActions.map((action) => (
                  <Button key={action.href} asChild variant="secondary" className="justify-between">
                    <Link href={action.href}>
                      {action.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
