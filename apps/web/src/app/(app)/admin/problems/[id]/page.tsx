"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProblemMarkdown, ProblemRichText } from "@/components/problems/problem-markdown"
import { parseProblemSamplesText, type ProblemSampleDraft } from "@/lib/problem-samples"
import { toast } from "sonner"

type Version = {
  id: string
  version: number
  statement: string
  statementMd?: string | null
  constraints?: string | null
  hints?: string | null
  inputFormat?: string | null
  outputFormat?: string | null
  samples?: unknown
  scratchRules?: unknown
  testdataGenerationConfig?: unknown
  notes?: string | null
  timeLimitMs: number
  memoryLimitMb: number
  judgeConfigs?: {
    id: string
    language: string
    languageId?: number | null
    judgeMode?: string | null
    timeLimitMs?: number | null
    memoryLimitMb?: number | null
    templateCode?: string | null
    templateCodeUri?: string | null
    entrypoint?: string | null
    entrySignature?: string | null
    compileCommand?: string | null
    runCommand?: string | null
    isEnabled: boolean
    isDefault: boolean
    sortOrder?: number | null
  }[]
  testcases: {
    id: string
    title?: string | null
    caseType?: number
    visible?: boolean
    score: number
    groupId?: string | null
    isSample: boolean
    sourceType?: "MANUAL" | "ZIP_IMPORT" | "AUTO_GENERATED"
    generationTaskId?: string | null
    generationOrdinal?: number | null
    orderIndex?: number | null
  }[]
}

type Solution = {
  id: string
  title: string
  summary?: string | null
  type: string
  visibility: string
  accessLevel?: string | null
  isPremium?: boolean
  videoUrl?: string | null
  createdAt: string
}

type ProblemMeta = {
  id: string
  slug: string
  title: string
  aliases?: string[]
  difficulty: number
  status: number
  visible: boolean
  defunct: string
  visibility: "public" | "private" | "hidden" | "contest"
  source?: string | null
  publishedAt?: string | null
  currentVersionId?: string | null
  version?: number | null
  tags?: string[]
}

type JudgeConfigDraft = {
  id?: string
  language: string
  judgeMode: string
  timeLimitMs: string
  memoryLimitMb: string
  templateCode: string
  templateCodeUri: string
  entrypoint: string
  entrySignature: string
  compileCommand: string
  runCommand: string
  isEnabled: boolean
  isDefault: boolean
  sortOrder: string
}

type EditableTestcaseDraft = {
  id: string
  title: string
  caseType: number
  visible: boolean
  score: string
  groupId: string
  isSample: boolean
  orderIndex: string
}

type ZipResult = {
  type: "success" | "error" | "info"
  message: string
}

type StandardSolutionItem = {
  id: string
  label: string
  language: string
  status: string
  isPrimary: boolean
  sourceHash?: string | null
  notes?: string | null
  sourceAsset?: {
    id: string
    uri: string
    fileName: string
    byteSize: number
    checksumSha256?: string | null
  } | null
  createdAt: string
  updatedAt?: string
}

type TestdataTaskItem = {
  id: string
  status: string
  stage: string
  mode: string
  configSource?: string
  seed?: string | null
  attemptNo: number
  standardSolution?: {
    id: string
    label: string
    language: string
  } | null
  plannedCaseCount: number
  generatedCaseCount: number
  succeededCaseCount: number
  failedCaseCount: number
  persistedCaseCount: number
  errorCode?: string | null
  errorMessage?: string | null
  packageAsset?: {
    id: string
    uri: string
    fileName: string
  } | null
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

type TestdataTaskLogItem = {
  id: string
  sequenceNo: number
  level: string
  stage: string
  code?: string | null
  message: string
  detail?: unknown
  createdAt: string
}

type TestdataTaskCaseItem = {
  id: string
  ordinal: number
  groupKey?: string | null
  title?: string | null
  score: number
  status: string
  executionStatus: string
  errorCode?: string | null
  errorMessage?: string | null
  inputAsset?: {
    id: string
    uri: string
    fileName: string
  } | null
  expectedOutputAsset?: {
    id: string
    uri: string
    fileName: string
  } | null
}

type TestdataAnalysisResult = {
  summary: {
    problemCategory: string[]
    inputStructures: string[]
    likelyPitfalls: string[]
  }
  recommendations: {
    primaryGenerator: {
      type: string
      score: number
    } | null
  }
  warnings: string[]
  reviewRequired: boolean
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" ? (value as JsonObject) : null
}

function asInt(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback
}

function parseOptionalPositiveInt(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function formatJson(value: unknown) {
  if (value == null) return ""
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

function getProblemStatusLabel(status: number) {
  switch (status) {
    case 0:
      return "草稿"
    case 10:
      return "审核中"
    case 20:
      return "已发布"
    case 30:
      return "已归档"
    default:
      return `状态 ${status}`
  }
}

function getCaseTypeLabel(caseType?: number, isSample?: boolean) {
  if (isSample || caseType === 0) return "样例"
  if (caseType === 2) return "压力"
  return "隐藏"
}

function toJudgeConfigDraft(
  config: NonNullable<Version["judgeConfigs"]>[number]
): JudgeConfigDraft {
  return {
    id: config.id,
    language: config.language,
    judgeMode: config.judgeMode ?? "standard",
    timeLimitMs: config.timeLimitMs ? String(config.timeLimitMs) : "",
    memoryLimitMb: config.memoryLimitMb ? String(config.memoryLimitMb) : "",
    templateCode: config.templateCode ?? "",
    templateCodeUri: config.templateCodeUri ?? "",
    entrypoint: config.entrypoint ?? "",
    entrySignature: config.entrySignature ?? "",
    compileCommand: config.compileCommand ?? "",
    runCommand: config.runCommand ?? "",
    isEnabled: config.isEnabled,
    isDefault: config.isDefault,
    sortOrder: config.sortOrder ? String(config.sortOrder) : "",
  }
}

const JUDGE_LANGUAGE_OPTIONS = [
  { value: "cpp17", label: "C++17" },
  { value: "cpp14", label: "C++14" },
  { value: "cpp11", label: "C++11" },
  { value: "python", label: "Python" },
]

function getJudgeConfigPreset(language: string) {
  switch (language) {
    case "python":
      return {
        judgeMode: "standard",
        templateCode: `def main():
    pass


if __name__ == "__main__":
    main()
`,
      }
    case "cpp14":
    case "cpp11":
    case "cpp17":
    default:
      return {
        judgeMode: "standard",
        templateCode: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  return 0;
}
`,
      }
  }
}

function isScratchTag(tag: string) {
  const normalized = tag.trim().toLowerCase()
  return (
    normalized.includes("scratch") ||
    normalized.includes("图形化") ||
    normalized.includes("sb3")
  )
}

function isCodeTag(tag: string) {
  const normalized = tag.trim().toLowerCase()
  return normalized === "c++" || normalized === "cpp" || normalized === "python" || normalized === "py"
}

function isScratchJudgeLanguage(language: string) {
  const normalized = language.trim().toLowerCase()
  return normalized === "sb3" || normalized.startsWith("scratch")
}

function resolveProblemWorkspaceMode(args: {
  tags?: string[]
  judgeConfigs?: Array<{ language: string }>
}) {
  const tags = args.tags ?? []
  const hasScratchTag = tags.some(isScratchTag)
  const hasExplicitCodeTag = tags.some(isCodeTag)
  const hasScratchJudge = (args.judgeConfigs ?? []).some((config) =>
    isScratchJudgeLanguage(config.language)
  )
  const hasCodeJudge = (args.judgeConfigs ?? []).some(
    (config) => !isScratchJudgeLanguage(config.language)
  )

  if (hasScratchTag && hasExplicitCodeTag) return "hybrid" as const
  if (hasScratchTag) return "scratch" as const
  if (hasExplicitCodeTag) return "code" as const

  const supportsScratch = hasScratchTag || hasScratchJudge
  const supportsCode = hasExplicitCodeTag || hasCodeJudge || !supportsScratch

  if (supportsScratch && supportsCode) return "hybrid" as const
  if (supportsScratch) return "scratch" as const
  return "code" as const
}

function getProblemModeLabel(mode: "code" | "scratch" | "hybrid") {
  switch (mode) {
    case "scratch":
      return "Scratch 题"
    case "hybrid":
      return "双轨题"
    case "code":
    default:
      return "代码题"
  }
}

function getProblemModeDescription(mode: "code" | "scratch" | "hybrid") {
  switch (mode) {
    case "scratch":
      return "当前题目按 Scratch 工作流管理：优先维护 Scratch 评测规则，不展示代码题的标程、测试点和 HUSTOJ 同步区。"
    case "hybrid":
      return "当前题目同时包含 Scratch 与代码轨道。后台会把两套配置拆开显示，避免再混在一个区块里编辑。"
    case "code":
    default:
      return "当前题目按标准输入输出代码题管理：维护 Judge 配置、标程、测试点和自动造数据。"
  }
}

function toEditableTestcase(
  testcase: Version["testcases"][number]
): EditableTestcaseDraft {
  return {
    id: testcase.id,
    title: testcase.title ?? "",
    caseType: testcase.caseType ?? (testcase.isSample ? 0 : 1),
    visible: testcase.visible ?? testcase.isSample,
    score: String(testcase.score),
    groupId: testcase.groupId ?? "",
    isSample: testcase.isSample,
    orderIndex: testcase.orderIndex ? String(testcase.orderIndex) : "",
  }
}

function PreviewField({
  title,
  content,
}: {
  title: string
  content?: string | null
}) {
  const value = content?.trim()
  if (!value) return null

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <ProblemRichText content={value} />
    </div>
  )
}

function SamplePreviewCard({
  sample,
  index,
}: {
  sample: ProblemSampleDraft
  index: number
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-sm font-medium text-foreground">样例 {index + 1}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            输入
          </div>
          <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
            {sample.input || "(empty)"}
          </pre>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            输出
          </div>
          <pre className="overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">
            {sample.output || "(empty)"}
          </pre>
        </div>
      </div>
      {sample.explain?.trim() ? (
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            说明
          </div>
          <ProblemRichText content={sample.explain} />
        </div>
      ) : null}
    </div>
  )
}

export default function AdminProblemDetailPage() {
  const params = useParams<{ id?: string | string[] }>()
  const pathname = usePathname()
  const paramId = Array.isArray(params.id) ? params.id[0] : params.id ?? ""
  const pathId = pathname?.split("/").filter(Boolean).pop() ?? ""
  const problemId = paramId || pathId
  const [problem, setProblem] = React.useState<ProblemMeta | null>(null)
  const [title, setTitle] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [aliasesText, setAliasesText] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("3")
  const [visibility, setVisibility] = React.useState<ProblemMeta["visibility"]>("public")
  const [source, setSource] = React.useState("")
  const [problemSaving, setProblemSaving] = React.useState(false)
  const [versions, setVersions] = React.useState<Version[]>([])
  const [solutions, setSolutions] = React.useState<Solution[]>([])
  const [statement, setStatement] = React.useState("")
  const [statementEditorMode, setStatementEditorMode] = React.useState<"edit" | "preview">("edit")
  const [constraints, setConstraints] = React.useState("")
  const [inputFormat, setInputFormat] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState("")
  const [samples, setSamples] = React.useState("")
  const [hints, setHints] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [timeLimitMs, setTimeLimitMs] = React.useState("1000")
  const [memoryLimitMb, setMemoryLimitMb] = React.useState("256")
  const [selectedVersionId, setSelectedVersionId] = React.useState("")
  const [tcInput, setTcInput] = React.useState("")
  const [tcOutput, setTcOutput] = React.useState("")
  const [tcScore, setTcScore] = React.useState("100")
  const [tcGroup, setTcGroup] = React.useState("")
  const [tcIsSample, setTcIsSample] = React.useState(false)
  const [tcOrder, setTcOrder] = React.useState("1")
  const [solutionTitle, setSolutionTitle] = React.useState("")
  const [solutionSummary, setSolutionSummary] = React.useState("")
  const [solutionContent, setSolutionContent] = React.useState("")
  const [solutionVideoUrl, setSolutionVideoUrl] = React.useState("")
  const [solutionVisibility, setSolutionVisibility] = React.useState<"public" | "vip" | "purchase" | "private">("public")
  const [solutionAccessLevel, setSolutionAccessLevel] = React.useState<
    "FREE" | "MEMBERSHIP" | "PURCHASE" | "MEMBERSHIP_OR_PURCHASE"
  >("FREE")
  const [solutionIsPremium, setSolutionIsPremium] = React.useState(false)
  const [syncResult, setSyncResult] = React.useState("")
  const [zipFile, setZipFile] = React.useState<File | null>(null)
  const [zipResult, setZipResult] = React.useState<ZipResult | null>(null)
  const [zipWarnings, setZipWarnings] = React.useState<string[]>([])
  const [zipUploading, setZipUploading] = React.useState(false)
  const [skipZipSync, setSkipZipSync] = React.useState(true)
  const [scratchRuleFile, setScratchRuleFile] = React.useState<File | null>(null)
  const [scratchRole, setScratchRole] = React.useState("")
  const [scratchRuleScore, setScratchRuleScore] = React.useState("10")
  const [scratchRuleMode, setScratchRuleMode] = React.useState<"append" | "replace">("replace")
  const [scratchRuleResult, setScratchRuleResult] = React.useState<ZipResult | null>(null)
  const [scratchRuleGenerating, setScratchRuleGenerating] = React.useState(false)
  const [scratchRulesText, setScratchRulesText] = React.useState("")
  const [scratchRulesDirty, setScratchRulesDirty] = React.useState(false)
  const [scratchRulesSaving, setScratchRulesSaving] = React.useState(false)
  const [scratchRulesSaveResult, setScratchRulesSaveResult] = React.useState<ZipResult | null>(null)
  const [scratchValidateFile, setScratchValidateFile] = React.useState<File | null>(null)
  const [scratchValidateRunning, setScratchValidateRunning] = React.useState(false)
  const [scratchValidateResult, setScratchValidateResult] = React.useState<ZipResult | null>(null)
  const [testdataConfigText, setTestdataConfigText] = React.useState("")
  const [testdataConfigDirty, setTestdataConfigDirty] = React.useState(false)
  const [testdataConfigSaving, setTestdataConfigSaving] = React.useState(false)
  const [testdataConfigResult, setTestdataConfigResult] = React.useState<ZipResult | null>(null)
  const [testdataAnalysisLoading, setTestdataAnalysisLoading] = React.useState(false)
  const [testdataAnalysisResult, setTestdataAnalysisResult] = React.useState<TestdataAnalysisResult | null>(null)
  const [standardSolutions, setStandardSolutions] = React.useState<StandardSolutionItem[]>([])
  const [standardSolutionFile, setStandardSolutionFile] = React.useState<File | null>(null)
  const [standardSolutionLanguage, setStandardSolutionLanguage] = React.useState("cpp17")
  const [standardSolutionLabel, setStandardSolutionLabel] = React.useState("")
  const [standardSolutionIsPrimary, setStandardSolutionIsPrimary] = React.useState(true)
  const [standardSolutionUploading, setStandardSolutionUploading] = React.useState(false)
  const [standardSolutionResult, setStandardSolutionResult] = React.useState<ZipResult | null>(null)
  const [selectedStandardSolutionId, setSelectedStandardSolutionId] = React.useState("")
  const [autoTestdataBusy, setAutoTestdataBusy] = React.useState(false)
  const [autoTestdataResult, setAutoTestdataResult] = React.useState<ZipResult | null>(null)
  const [testdataTaskMode, setTestdataTaskMode] = React.useState<"APPEND" | "REPLACE_GENERATED" | "REPLACE_ALL">("REPLACE_GENERATED")
  const [testdataTaskCaseCount, setTestdataTaskCaseCount] = React.useState("10")
  const [testdataTaskTotalScore, setTestdataTaskTotalScore] = React.useState("100")
  const [testdataTaskSeed, setTestdataTaskSeed] = React.useState("")
  const [testdataTaskCreating, setTestdataTaskCreating] = React.useState(false)
  const [testdataTaskResult, setTestdataTaskResult] = React.useState<ZipResult | null>(null)
  const [testdataTasks, setTestdataTasks] = React.useState<TestdataTaskItem[]>([])
  const [selectedTestdataTaskId, setSelectedTestdataTaskId] = React.useState("")
  const [selectedTestdataTask, setSelectedTestdataTask] = React.useState<TestdataTaskItem | null>(null)
  const [testdataTaskLoading, setTestdataTaskLoading] = React.useState(false)
  const [testdataTaskLogs, setTestdataTaskLogs] = React.useState<TestdataTaskLogItem[]>([])
  const [testdataTaskCases, setTestdataTaskCases] = React.useState<TestdataTaskCaseItem[]>([])
  const [testdataTaskRefreshing, setTestdataTaskRefreshing] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [tagsSaving, setTagsSaving] = React.useState(false)
  const [judgeConfigsDraft, setJudgeConfigsDraft] = React.useState<JudgeConfigDraft[]>([])
  const [judgeConfigsSaving, setJudgeConfigsSaving] = React.useState(false)
  const [editableTestcases, setEditableTestcases] = React.useState<EditableTestcaseDraft[]>([])
  const [testcaseSavingId, setTestcaseSavingId] = React.useState<string | null>(null)
  const [testcaseDeletingId, setTestcaseDeletingId] = React.useState<string | null>(null)
  const prevScratchRulesVersionIdRef = React.useRef("")
  const prevTestdataConfigVersionIdRef = React.useRef("")

  const languageTags = [
    "scratch-必做",
    "scratch-可选",
    "C++",
    "Python",
  ]

  const dataStructureTags = [
    "数组",
    "链表",
    "栈",
    "队列",
    "哈希表",
    "堆",
    "树",
    "二叉树",
    "二叉搜索树",
    "平衡树",
    "线段树",
    "树状数组",
    "图",
    "并查集",
    "字符串",
    "字典树",
    "位运算",
  ]

  const algorithmTags = [
    "双指针",
    "贪心",
    "动态规划",
    "回溯",
    "DFS",
    "BFS",
    "最短路",
    "拓扑排序",
    "最小生成树",
    "分治",
    "二分",
    "排序",
    "模拟",
    "数学",
    "数论",
    "枚举",
    "前缀和",
    "差分",
    "滑动窗口",
    "单调栈",
    "单调队列",
    "扫描线",
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }
  const load = React.useCallback(async () => {
    const pRes = await fetch(`/api/admin/problems/${problemId}`, {
      credentials: "include",
    })
    if (pRes.ok) {
      const pData = (await pRes.json()) as ProblemMeta
      setProblem(pData)
      setTitle(pData.title ?? "")
      setSlug(pData.slug ?? "")
      setAliasesText(Array.isArray(pData.aliases) ? pData.aliases.join(", ") : "")
      setDifficulty(String(pData.difficulty ?? 3))
      setVisibility(pData.visibility ?? "public")
      setSource(pData.source ?? "")
      if (Array.isArray(pData?.tags)) {
        setSelectedTags(pData.tags)
      }
    }

    const vRes = await fetch(`/api/admin/problems/${problemId}/versions`, {
      credentials: "include",
    })
    const vData = await vRes.json()
    const nextVersions = Array.isArray(vData) ? (vData as Version[]) : []
    setVersions(nextVersions)
    setSelectedVersionId((current) =>
      current && nextVersions.some((item) => item.id === current)
        ? current
        : (nextVersions[0]?.id ?? "")
    )

    const sRes = await fetch(`/api/admin/problems/${problemId}/solutions`, {
      credentials: "include",
    })
    const sData = await sRes.json()
    setSolutions(Array.isArray(sData) ? (sData as Solution[]) : [])
  }, [problemId])

  React.useEffect(() => {
    if (problemId) load()
  }, [problemId, load])

  const selectedVersion = React.useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? null,
    [selectedVersionId, versions]
  )
  const effectiveProblemTags = React.useMemo(
    () => (selectedTags.length > 0 ? selectedTags : problem?.tags ?? []),
    [problem?.tags, selectedTags]
  )
  const problemMode = React.useMemo(
    () =>
      resolveProblemWorkspaceMode({
        tags: effectiveProblemTags,
        judgeConfigs: selectedVersion?.judgeConfigs ?? [],
      }),
    [effectiveProblemTags, selectedVersion?.judgeConfigs]
  )
  const supportsCodeWorkflow = problemMode === "code" || problemMode === "hybrid"
  const supportsScratchWorkflow = problemMode === "scratch" || problemMode === "hybrid"
  const codeJudgeConfigEntries = React.useMemo(
    () =>
      judgeConfigsDraft
        .map((config, index) => ({ config, index }))
        .filter((item) => !isScratchJudgeLanguage(item.config.language)),
    [judgeConfigsDraft]
  )
  const scratchJudgeConfigEntries = React.useMemo(
    () =>
      judgeConfigsDraft
        .map((config, index) => ({ config, index }))
        .filter((item) => isScratchJudgeLanguage(item.config.language)),
    [judgeConfigsDraft]
  )
  const samplePreview = React.useMemo(
    () => parseProblemSamplesText(samples),
    [samples]
  )
  const hasDraftVersionPreview =
    Boolean(statement.trim()) ||
    Boolean(inputFormat.trim()) ||
    Boolean(outputFormat.trim()) ||
    Boolean(constraints.trim()) ||
    Boolean(hints.trim()) ||
    Boolean(notes.trim()) ||
    Boolean(samples.trim()) ||
    Boolean(timeLimitMs.trim()) ||
    Boolean(memoryLimitMb.trim())

  React.useEffect(() => {
    setJudgeConfigsDraft(
      (selectedVersion?.judgeConfigs ?? []).map(toJudgeConfigDraft)
    )
    setEditableTestcases(
      (selectedVersion?.testcases ?? []).map(toEditableTestcase)
    )
  }, [selectedVersion])

  React.useEffect(() => {
    const versionChanged = prevScratchRulesVersionIdRef.current !== selectedVersionId
    if (versionChanged || !scratchRulesDirty) {
      setScratchRulesText(formatJson(selectedVersion?.scratchRules))
      setScratchRulesSaveResult(null)
      setScratchValidateResult(null)
      setScratchValidateFile(null)
      if (versionChanged) {
        setScratchRulesDirty(false)
      }
    }
    prevScratchRulesVersionIdRef.current = selectedVersionId
  }, [selectedVersion, selectedVersionId, scratchRulesDirty])

  React.useEffect(() => {
    const versionChanged = prevTestdataConfigVersionIdRef.current !== selectedVersionId
    if (versionChanged || !testdataConfigDirty) {
      setTestdataConfigText(formatJson(selectedVersion?.testdataGenerationConfig))
      setTestdataConfigResult(null)
      setTestdataAnalysisResult(null)
      if (versionChanged) {
        setTestdataConfigDirty(false)
      }
    }
    prevTestdataConfigVersionIdRef.current = selectedVersionId
  }, [selectedVersion, selectedVersionId, testdataConfigDirty])

  const loadTestdataResources = React.useCallback(async () => {
    if (!selectedVersionId) {
      setStandardSolutions([])
      setTestdataTasks([])
      setSelectedStandardSolutionId("")
      setSelectedTestdataTaskId("")
      setSelectedTestdataTask(null)
      setTestdataTaskLogs([])
      setTestdataTaskCases([])
      return
    }

    setTestdataTaskRefreshing(true)
    const [solutionsRes, tasksRes] = await Promise.all([
      fetch(`/api/admin/versions/${selectedVersionId}/standard-solutions`, {
        credentials: "include",
      }),
      fetch(`/api/admin/versions/${selectedVersionId}/testdata-generation-tasks`, {
        credentials: "include",
      }),
    ])

    const solutionsData = await solutionsRes.json().catch(() => null)
    const nextSolutions = Array.isArray(solutionsData?.items)
      ? (solutionsData.items as StandardSolutionItem[])
      : []
    setStandardSolutions(nextSolutions)
    setSelectedStandardSolutionId((current) => {
      if (current && nextSolutions.some((item) => item.id === current)) {
        return current
      }
      return nextSolutions.find((item) => item.isPrimary)?.id ?? nextSolutions[0]?.id ?? ""
    })

    const tasksData = await tasksRes.json().catch(() => null)
    const nextTasks = Array.isArray(tasksData?.items)
      ? (tasksData.items as TestdataTaskItem[])
      : []
    setTestdataTasks(nextTasks)
    setSelectedTestdataTaskId((current) => {
      if (current && nextTasks.some((item) => item.id === current)) {
        return current
      }
      return nextTasks[0]?.id ?? ""
    })
    setTestdataTaskRefreshing(false)
  }, [selectedVersionId])

  React.useEffect(() => {
    void loadTestdataResources()
  }, [loadTestdataResources])

  React.useEffect(() => {
    if (!selectedTestdataTaskId) {
      setSelectedTestdataTask(null)
      setTestdataTaskLogs([])
      setTestdataTaskCases([])
      return
    }

    let cancelled = false
    const run = async () => {
      setTestdataTaskLoading(true)
      const [taskRes, logsRes, casesRes] = await Promise.all([
        fetch(`/api/admin/testdata-generation-tasks/${selectedTestdataTaskId}`, {
          credentials: "include",
        }),
        fetch(`/api/admin/testdata-generation-tasks/${selectedTestdataTaskId}/logs?pageSize=50`, {
          credentials: "include",
        }),
        fetch(`/api/admin/testdata-generation-tasks/${selectedTestdataTaskId}/cases?pageSize=50`, {
          credentials: "include",
        }),
      ])

      const [taskData, logsData, casesData] = await Promise.all([
        taskRes.json().catch(() => null),
        logsRes.json().catch(() => null),
        casesRes.json().catch(() => null),
      ])

      if (cancelled) return
      setSelectedTestdataTask(taskData as TestdataTaskItem | null)
      setTestdataTaskLogs(
        Array.isArray(logsData?.items) ? (logsData.items as TestdataTaskLogItem[]) : []
      )
      setTestdataTaskCases(
        Array.isArray(casesData?.items) ? (casesData.items as TestdataTaskCaseItem[]) : []
      )
      setTestdataTaskLoading(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [selectedTestdataTaskId])

  const createVersion = async () => {
    if (samples.trim() && samplePreview.error) {
      toast.error("样例 JSON 无法保存", { description: samplePreview.error })
      return
    }

    const payload: Record<string, unknown> = {
      statement,
      constraints: constraints || undefined,
      inputFormat: inputFormat || undefined,
      outputFormat: outputFormat || undefined,
      hints: hints || undefined,
      notes: notes || undefined,
      timeLimitMs: Number(timeLimitMs || 1000),
      memoryLimitMb: Number(memoryLimitMb || 256),
    }
    if (samples) {
      payload.samples = samplePreview.items
    }
    await fetch(`/api/admin/problems/${problemId}/versions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setStatement("")
    setConstraints("")
    setInputFormat("")
    setOutputFormat("")
    setSamples("")
    setHints("")
    setNotes("")
    await load()
  }

  const saveProblemMeta = async () => {
    if (!problemId) return
    setProblemSaving(true)
    const res = await fetch(`/api/admin/problems/${problemId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug,
        aliases: aliasesText
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
        difficulty: Number(difficulty || 3),
        visibility,
        source: source || undefined,
      }),
    })
    setProblemSaving(false)
    if (res.ok) {
      toast.success("题目基础信息已保存")
      await load()
    } else {
      const data = await res.json().catch(() => null)
      toast.error(typeof data?.error === "string" ? data.error : "保存失败")
    }
  }

  const saveTags = async () => {
    if (!problemId) return
    setTagsSaving(true)
    const res = await fetch(`/api/admin/problems/${problemId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: selectedTags }),
    })
    setTagsSaving(false)
    if (res.ok) {
      toast.success("标签已保存")
    } else {
      toast.error("保存失败")
    }
  }

  const addTestcase = async () => {
    if (!selectedVersionId) return
    await fetch(`/api/admin/versions/${selectedVersionId}/testcases`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testcases: [
          {
            input: tcInput,
            output: tcOutput,
            score: Number(tcScore || 0),
            groupId: tcGroup || undefined,
            isSample: tcIsSample,
            orderIndex: Number(tcOrder || 1),
          },
        ],
      }),
    })
    setTcInput("")
    setTcOutput("")
    await load()
  }

  const updateJudgeConfig = (
    index: number,
    patch: Partial<JudgeConfigDraft>
  ) => {
    setJudgeConfigsDraft((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    )
  }

  const applyJudgeConfigPreset = (index: number, language: string) => {
    const preset = getJudgeConfigPreset(language)
    updateJudgeConfig(index, {
      language,
      judgeMode: preset.judgeMode,
      templateCode: preset.templateCode,
    })
  }

  const addJudgeConfig = () => {
    setJudgeConfigsDraft((prev) => [
      ...prev,
      {
        language: "cpp17",
        judgeMode: "standard",
        timeLimitMs: selectedVersion?.timeLimitMs ? String(selectedVersion.timeLimitMs) : "",
        memoryLimitMb: selectedVersion?.memoryLimitMb ? String(selectedVersion.memoryLimitMb) : "",
        templateCode: "",
        templateCodeUri: "",
        entrypoint: "",
        entrySignature: "",
        compileCommand: "",
        runCommand: "",
        isEnabled: true,
        isDefault: prev.length === 0,
        sortOrder: String((prev.length + 1) * 10),
      },
    ])
  }

  const removeJudgeConfig = (index: number) => {
    setJudgeConfigsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const saveJudgeConfigs = async () => {
    if (!selectedVersionId) return
    setJudgeConfigsSaving(true)
    const res = await fetch(`/api/admin/versions/${selectedVersionId}/judge-configs`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        judgeConfigs: judgeConfigsDraft.map((config, index) => ({
          language: config.language,
          judgeMode: config.judgeMode,
          timeLimitMs: config.timeLimitMs ? Number(config.timeLimitMs) : null,
          memoryLimitMb: config.memoryLimitMb ? Number(config.memoryLimitMb) : null,
          templateCode: config.templateCode || null,
          templateCodeUri: config.templateCodeUri || null,
          entrypoint: config.entrypoint || null,
          entrySignature: config.entrySignature || null,
          compileCommand: config.compileCommand || null,
          runCommand: config.runCommand || null,
          isEnabled: config.isEnabled,
          isDefault: config.isDefault,
          sortOrder: config.sortOrder ? Number(config.sortOrder) : (index + 1) * 10,
        })),
      }),
    })
    setJudgeConfigsSaving(false)
    if (res.ok) {
      toast.success("Judge 配置已保存")
      await load()
    } else {
      const data = await res.json().catch(() => null)
      toast.error(typeof data?.error === "string" ? data.error : "保存失败")
    }
  }

  const updateEditableTestcase = (
    id: string,
    patch: Partial<EditableTestcaseDraft>
  ) => {
    setEditableTestcases((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const applyEditableCaseType = (id: string, caseType: number) => {
    const isSample = caseType === 0
    updateEditableTestcase(id, {
      caseType,
      isSample,
      visible: isSample ? true : false,
    })
  }

  const saveEditableTestcase = async (testcase: EditableTestcaseDraft) => {
    setTestcaseSavingId(testcase.id)
    const res = await fetch(`/api/admin/testcases/${testcase.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: testcase.title || null,
        caseType: testcase.caseType,
        visible: testcase.visible,
        score: Number(testcase.score || 0),
        groupId: testcase.groupId || null,
        isSample: testcase.isSample,
        orderIndex: testcase.orderIndex ? Number(testcase.orderIndex) : null,
      }),
    })
    setTestcaseSavingId(null)
    if (res.ok) {
      toast.success("测试点已保存")
      await load()
    } else {
      const data = await res.json().catch(() => null)
      toast.error(typeof data?.error === "string" ? data.error : "测试点保存失败")
    }
  }

  const deleteEditableTestcase = async (id: string) => {
    setTestcaseDeletingId(id)
    const res = await fetch(`/api/admin/testcases/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    setTestcaseDeletingId(null)
    if (res.ok) {
      toast.success("测试点已删除")
      await load()
    } else {
      const data = await res.json().catch(() => null)
      toast.error(typeof data?.error === "string" ? data.error : "测试点删除失败")
    }
  }

  const uploadZip = async () => {
    if (!problemId || !zipFile) return
    const zipName = (zipFile.name || "").split("/").pop() || zipFile.name
    if (!zipName.toLowerCase().endsWith(".zip")) {
      const errorMessage = "请选择 .zip 文件后再上传"
      setZipResult({ type: "error", message: errorMessage })
      setZipWarnings([])
      toast.error("测试点上传失败", { description: errorMessage })
      return
    }
    if (zipFile.size === 0) {
      const errorMessage = "ZIP 文件为空，请重新选择"
      setZipResult({ type: "error", message: errorMessage })
      setZipWarnings([])
      toast.error("测试点上传失败", { description: errorMessage })
      return
    }
    if (zipName !== `${problemId}.zip`) {
      const errorMessage = `ZIP 文件名必须是 ${problemId}.zip`
      setZipResult({ type: "error", message: errorMessage })
      setZipWarnings([])
      toast.error("测试点上传失败", { description: errorMessage })
      return
    }
    setZipUploading(true)
    setZipResult(null)
    setZipWarnings([])
    const form = new FormData()
    form.append("zip", zipFile)
    form.append("skipSync", String(skipZipSync))
    const res = await fetch(`/api/admin/problems/${problemId}/testcases-zip`, {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (data) {
      if (res.ok) {
        const rawWarnings = Array.isArray(data.warnings) ? data.warnings : []
        const formattedWarnings = rawWarnings
          .map((warning) => {
            const warningObj = asObject(warning)
            const code =
              warningObj && typeof warningObj.code === "string" ? warningObj.code : "warning"
            const detail =
              warningObj && warningObj.detail !== undefined
                ? JSON.stringify(warningObj.detail)
                : ""
            return detail ? `${code}: ${detail}` : code
          })
          .filter(Boolean)
        if (formattedWarnings.length) {
          setZipWarnings(formattedWarnings)
        }
        const syncObj = asObject(data.sync)
        const syncMsg = syncObj?.ok === true
          ? syncObj?.skipped === true
            ? "已跳过 HUSTOJ 同步"
            : `已同步 HUSTOJ (id: ${String(syncObj.hustojProblemId ?? "-")})`
          : typeof syncObj?.error === "string"
            ? `同步失败：${syncObj.error}`
            : "同步状态未知"
        const warningSummary = formattedWarnings.length
          ? ` 警告 ${formattedWarnings.length} 条`
          : ""
        const successMessage = `上传成功，写入 ${asInt(data.count, 0)} 个测试点。${syncMsg}${warningSummary}`
        setZipResult({
          type: formattedWarnings.length ? "info" : "success",
          message: successMessage,
        })
        if (formattedWarnings.length) {
          toast.info("测试点上传完成（有警告）", { description: successMessage })
        } else {
          toast.success("测试点上传成功", { description: successMessage })
        }
        if (formattedWarnings.length) {
          toast.info("上传警告", { description: formattedWarnings.slice(0, 3).join("；") })
        }
      } else {
        const detail = data.detail
          ? `：${typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)}`
          : ""
        const rollback = data.rollback ? `，回滚：${String(data.rollback)}` : ""
        const errorCode = typeof data.error === "string" ? data.error : res.statusText
        const errorMessage = `上传失败 (${errorCode})${detail}${rollback}`
        setZipResult({
          type: "error",
          message: errorMessage,
        })
        setZipWarnings([])
        toast.error("测试点上传失败", { description: errorMessage })
      }
    } else {
      const fallbackMessage = text || `上传失败: ${res.status} ${res.statusText}`
      const fallbackType = res.ok ? "success" : "error"
      setZipResult({
        type: fallbackType,
        message: fallbackMessage,
      })
      setZipWarnings([])
      if (fallbackType === "success") {
        toast.success("测试点上传成功", { description: fallbackMessage })
      } else {
        toast.error("测试点上传失败", { description: fallbackMessage })
      }
    }

    setZipUploading(false)
    if (res.ok) {
      setZipFile(null)
    }
    await load()
  }

  const generateScratchRules = async () => {
    if (!problemId || !scratchRuleFile) return
    setScratchRuleGenerating(true)
    setScratchRuleResult(null)
    const form = new FormData()
    form.append("answer", scratchRuleFile)
    if (selectedVersionId) form.append("versionId", selectedVersionId)
    if (scratchRole.trim()) form.append("role", scratchRole.trim())
    if (scratchRuleScore.trim()) form.append("score", scratchRuleScore.trim())
    form.append("mode", scratchRuleMode)
    const res = await fetch(`/api/admin/problems/${problemId}/scratch-rules`, {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }
    if (res.ok && data) {
      const msg = data.completedFromDraft === true
        ? data.draftSource === "statement"
          ? `已根据题干和答案自动生成完整规则：版本 ${String(data.versionId ?? "-")}，分段 ${asInt(data.parts, 0)}，总分 ${String(data.totalScore ?? "-")}`
          : `已根据题干草稿和答案自动补全：版本 ${String(data.versionId ?? "-")}，分段 ${asInt(data.parts, 0)}，总分 ${String(data.totalScore ?? "-")}`
        : data.batch === true
          ? `批量生成成功：版本 ${String(data.versionId ?? "-")}，角色 ${String(data.role ?? "-")}，导入 ${asInt(data.imported, 0)} 个得分点，总分 ${String(data.totalScore ?? data.score ?? scratchRuleScore)}`
          : `生成成功：版本 ${String(data.versionId ?? "-")}，角色 ${String(data.role ?? "-")}，脚本 ${asInt(data.scripts, 0)}，分值 ${String(data.score ?? scratchRuleScore)}`
      setScratchRuleResult({ type: "success", message: msg })
      toast.success("Scratch 规则已生成", { description: msg })
      setScratchRuleFile(null)
    } else {
      const errMessage = data?.error
        ? `${data.error}${data.detail ? `: ${JSON.stringify(data.detail)}` : ""}`
        : text || res.statusText
      setScratchRuleResult({ type: "error", message: errMessage })
      toast.error("Scratch 规则生成失败", { description: errMessage })
    }
    setScratchRuleGenerating(false)
    await load()
  }

  const saveScratchRulesJson = async () => {
    if (!selectedVersionId) return

    let scratchRules: unknown = null
    if (scratchRulesText.trim()) {
      try {
        scratchRules = JSON.parse(scratchRulesText)
      } catch (error) {
        const message = error instanceof Error ? error.message : "scratch_rules_json_invalid"
        setScratchRulesSaveResult({ type: "error", message })
        toast.error("Scratch 规则 JSON 无效", { description: message })
        return
      }
    }

    setScratchRulesSaving(true)
    setScratchRulesSaveResult(null)

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/scratch-rules`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scratchRules }),
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (res.ok) {
      const message = scratchRules === null
        ? `已清空版本 ${selectedVersionId} 的 Scratch 规则`
        : `已保存版本 ${selectedVersionId} 的 Scratch 规则`
      setScratchRulesDirty(false)
      setScratchRulesSaveResult({ type: "success", message })
      toast.success("Scratch 规则已保存", { description: message })
      await load()
    } else {
      const message = data?.error ? String(data.error) : text || res.statusText
      setScratchRulesSaveResult({ type: "error", message })
      toast.error("Scratch 规则保存失败", { description: message })
    }

    setScratchRulesSaving(false)
  }

  const validateScratchRulesJson = async () => {
    if (!selectedVersionId || !scratchValidateFile) return

    setScratchValidateRunning(true)
    setScratchValidateResult(null)

    const form = new FormData()
    form.append("answer", scratchValidateFile)
    if (scratchRulesText.trim()) {
      form.append("scratchRules", scratchRulesText)
    }

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/scratch-rules`, {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (res.ok && data) {
      const prefix = data.completedFromDraft === true
        ? data.draftSource === "statement"
          ? "已按题干自动生成规则后验证"
          : "已按题干草稿自动补全后验证"
        : "验证结果"
      const message = `${prefix}：${String(data.status ?? "-")}，得分 ${String(data.score ?? 0)}/${String(data.total ?? 0)}，通过 ${String(data.passed ?? 0)} 项${Array.isArray(data.errors) && data.errors.length ? `，错误 ${JSON.stringify(data.errors)}` : ""}`
      setScratchValidateResult({ type: "success", message })
      toast.success("Scratch 规则验证完成", { description: message })
    } else {
      const message = data?.error ? String(data.error) : text || res.statusText
      setScratchValidateResult({ type: "error", message })
      toast.error("Scratch 规则验证失败", { description: message })
    }

    setScratchValidateRunning(false)
  }

  const saveTestdataGenerationConfig = async () => {
    if (!selectedVersionId) return

    let config: unknown = null
    if (testdataConfigText.trim()) {
      try {
        config = JSON.parse(testdataConfigText)
      } catch (error) {
        const message = error instanceof Error ? error.message : "testdata_generation_config_invalid"
        setTestdataConfigResult({ type: "error", message })
        toast.error("测试数据生成配置无效", { description: message })
        return
      }
    }

    setTestdataConfigSaving(true)
    setTestdataConfigResult(null)

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/testdata-generation-config`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (res.ok) {
      const message = `已保存版本 ${selectedVersionId} 的测试数据生成配置`
      setTestdataConfigDirty(false)
      setTestdataConfigResult({ type: "success", message })
      toast.success("测试数据生成配置已保存", { description: message })
      await load()
    } else {
      const message = data?.error ? String(data.error) : text || res.statusText
      setTestdataConfigResult({ type: "error", message })
      toast.error("测试数据生成配置保存失败", { description: message })
    }

    setTestdataConfigSaving(false)
  }

  const requestTestdataAnalysis = async (standardSolutionId?: string) => {
    if (!selectedVersionId) {
      throw new Error("请先选择题目版本")
    }

    const search = new URLSearchParams()
    const testcaseCount = parseOptionalPositiveInt(testdataTaskCaseCount)
    const totalScore = parseOptionalPositiveInt(testdataTaskTotalScore)
    if (testcaseCount) {
      search.set("testcaseCount", String(testcaseCount))
    }
    if (totalScore) {
      search.set("totalScore", String(totalScore))
    }
    if (standardSolutionId) {
      search.set("standardSolutionId", standardSolutionId)
    }

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/testdata-generation-analysis?${search.toString()}`, {
      credentials: "include",
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (!res.ok) {
      const message = data?.message ? String(data.message) : data?.error ? String(data.error) : text || res.statusText
      throw new Error(message)
    }

    return {
      analysis: asObject(data?.analysis) as TestdataAnalysisResult | null,
      configDraft: data?.configDraft ?? null,
    }
  }

  const requestUploadStandardSolution = async () => {
    if (!selectedVersionId || !standardSolutionFile) {
      throw new Error("请先选择版本并上传标程文件")
    }

    const form = new FormData()
    form.append("file", standardSolutionFile)
    form.append("language", standardSolutionLanguage)
    if (standardSolutionLabel.trim()) {
      form.append("label", standardSolutionLabel.trim())
    }
    form.append("isPrimary", String(standardSolutionIsPrimary))

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/standard-solutions`, {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (!res.ok || !data) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : data?.error
            ? String(data.error)
            : text || res.statusText
      throw new Error(message)
    }

    const solution = asObject(data.solution)
    return {
      id: String(solution?.id ?? ""),
      label: String(solution?.label ?? standardSolutionFile.name),
    }
  }

  const requestSaveTestdataGenerationConfig = async (config: unknown) => {
    if (!selectedVersionId) {
      throw new Error("请先选择题目版本")
    }

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/testdata-generation-config`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (!res.ok) {
      const message = data?.error ? String(data.error) : text || res.statusText
      throw new Error(message)
    }
  }

  const requestCreateTestdataGenerationTask = async (standardSolutionId: string) => {
    if (!selectedVersionId || !standardSolutionId) {
      throw new Error("请先选择版本和标程")
    }

    const testcaseCount = parseOptionalPositiveInt(testdataTaskCaseCount)
    if (!testcaseCount) {
      throw new Error("请填写测试点个数")
    }

    const totalScore = parseOptionalPositiveInt(testdataTaskTotalScore)
    const payload: Record<string, unknown> = {
      standardSolutionId,
      mode: testdataTaskMode,
      testcaseCount,
      seed: testdataTaskSeed.trim() || undefined,
    }
    if (totalScore) {
      payload.totalScore = totalScore
    }

    const res = await fetch(`/api/admin/versions/${selectedVersionId}/testdata-generation-tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (!res.ok || !data) {
      const message = data?.error ? String(data.error) : text || res.statusText
      throw new Error(message)
    }

    const task = asObject(data.task)
    return {
      id: String(task?.id ?? ""),
      configSource: typeof task?.configSource === "string" ? task.configSource : "saved_config",
      plannedCaseCount: String(task?.plannedCaseCount ?? 0),
      persistedCaseCount: Number(task?.persistedCaseCount ?? 0),
      status: typeof task?.status === "string" ? task.status : "",
      errorMessage: typeof task?.errorMessage === "string" ? task.errorMessage : "",
    }
  }

  const analyzeTestdataGenerationConfig = async () => {
    if (!selectedVersionId) return

    setTestdataAnalysisLoading(true)
    setTestdataConfigResult(null)

    try {
      const { analysis, configDraft } = await requestTestdataAnalysis(selectedStandardSolutionId || undefined)
      setTestdataAnalysisResult(analysis)

      if (configDraft) {
        setTestdataConfigText(JSON.stringify(configDraft, null, 2))
        setTestdataConfigDirty(true)
        const primary = analysis?.recommendations?.primaryGenerator?.type ?? "unknown"
        const message = `已按题面、标签${selectedStandardSolutionId ? "和标程代码" : ""}分析生成 ${primary} 配置草稿；你现在可以直接创建任务，或先保存为高级配置`
        setTestdataConfigResult({ type: "info", message })
        toast.success("已生成测试数据配置草稿", { description: message })
      } else {
        const message = "已生成分析结果，但当前题型仍需要人工补充 generator 配置"
        setTestdataConfigResult({ type: "info", message })
        toast.message("需要人工补充配置", { description: message })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "testdata_generation_analysis_failed"
      setTestdataConfigResult({ type: "error", message })
      toast.error("题目分析失败", { description: message })
    }

    setTestdataAnalysisLoading(false)
  }

  const uploadStandardSolution = async () => {
    if (!selectedVersionId || !standardSolutionFile) return

    setStandardSolutionUploading(true)
    setStandardSolutionResult(null)
    try {
      const solution = await requestUploadStandardSolution()
      const message = `已上传标程 ${solution.label}`
      setStandardSolutionResult({ type: "success", message })
      toast.success("标程上传成功", { description: message })
      setSelectedStandardSolutionId(solution.id)
      setStandardSolutionFile(null)
      setStandardSolutionLabel("")
      await loadTestdataResources()
    } catch (error) {
      const message = error instanceof Error ? error.message : "standard_solution_upload_failed"
      setStandardSolutionResult({ type: "error", message })
      toast.error("标程上传失败", { description: message })
    }

    setStandardSolutionUploading(false)
  }

  const createTestdataGenerationTask = async () => {
    if (!selectedVersionId || !selectedStandardSolutionId) return

    setTestdataTaskCreating(true)
    setTestdataTaskResult(null)
    try {
      const task = await requestCreateTestdataGenerationTask(selectedStandardSolutionId)
      const message =
        task.status === "SUCCEEDED"
          ? `已直接写入 ${task.persistedCaseCount} 个测试点，来源 ${task.configSource === "auto_analysis" ? "自动分析" : "已保存配置"}`
          : `已创建任务 ${task.id}，计划 ${task.plannedCaseCount} 组，当前状态 ${task.status || "未知"}${task.errorMessage ? `：${task.errorMessage}` : ""}`
      setTestdataTaskResult({ type: "success", message })
      toast.success(task.status === "SUCCEEDED" ? "测试点已生成并写入" : "测试数据生成任务已创建", {
        description: message,
      })
      setTestdataTaskSeed("")
      await loadTestdataResources()
      if (task.id) {
        setSelectedTestdataTaskId(task.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "testdata_generation_task_create_failed"
      setTestdataTaskResult({ type: "error", message })
      toast.error("测试数据生成任务创建失败", { description: message })
    }

    setTestdataTaskCreating(false)
  }

  const uploadSolutionAndAutoGenerateTestdata = async () => {
    if (!selectedVersionId) return

    const testcaseCount = parseOptionalPositiveInt(testdataTaskCaseCount)
    if (!testcaseCount) {
      const message = "请先填写测试点个数"
      setAutoTestdataResult({ type: "error", message })
      toast.error("无法自动生成测试点", { description: message })
      return
    }

    setAutoTestdataBusy(true)
    setAutoTestdataResult(null)
    setTestdataTaskResult(null)
    setStandardSolutionResult(null)

    try {
      let standardSolutionId = selectedStandardSolutionId
      let uploadedLabel = ""

      if (standardSolutionFile) {
        const uploaded = await requestUploadStandardSolution()
        standardSolutionId = uploaded.id
        uploadedLabel = uploaded.label
        setSelectedStandardSolutionId(uploaded.id)
        setStandardSolutionResult({ type: "success", message: `已上传标程 ${uploaded.label}` })
        setStandardSolutionFile(null)
        setStandardSolutionLabel("")
      }

      if (!standardSolutionId) {
        throw new Error("请先上传标程，或选择已有标程")
      }

      const { analysis, configDraft } = await requestTestdataAnalysis(standardSolutionId)
      setTestdataAnalysisResult(analysis)

      if (!configDraft) {
        const detected = analysis?.recommendations?.primaryGenerator?.type ?? "未识别"
        throw new Error(`当前自动识别为 ${detected}，但系统还不能为该类型直接生成配置，请先走高级配置。`)
      }

      setTestdataConfigText(JSON.stringify(configDraft, null, 2))
      await requestSaveTestdataGenerationConfig(configDraft)
      setTestdataConfigDirty(false)
      setTestdataConfigResult({
        type: "success",
        message: `已按题面、标签和标程自动保存 ${analysis?.recommendations?.primaryGenerator?.type ?? "unknown"} 配置`,
      })

      const task = await requestCreateTestdataGenerationTask(standardSolutionId)
      await loadTestdataResources()
      if (task.id) {
        setSelectedTestdataTaskId(task.id)
      }

      const parts = [
        uploadedLabel ? `标程 ${uploadedLabel}` : "已使用当前默认标程",
        `识别类型 ${analysis?.recommendations?.primaryGenerator?.type ?? "unknown"}`,
        task.status === "SUCCEEDED"
          ? `已直接写入 ${task.persistedCaseCount} 个测试点`
          : `已创建 ${task.plannedCaseCount} 组测试点任务`,
      ]
      const message = parts.join("，")
      setAutoTestdataResult({ type: "success", message })
      setTestdataTaskResult({ type: "success", message })
      toast.success(task.status === "SUCCEEDED" ? "自动生成测试点完成" : "自动生成测试点任务已创建", {
        description: message,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "auto_testdata_generation_failed"
      setAutoTestdataResult({ type: "error", message })
      toast.error("自动生成测试点失败", { description: message })
    }

    setAutoTestdataBusy(false)
  }

  const retrySelectedTestdataTask = async () => {
    if (!selectedTestdataTaskId) return

    setTestdataTaskCreating(true)
    const res = await fetch(`/api/admin/testdata-generation-tasks/${selectedTestdataTaskId}/retry`, {
      method: "POST",
      credentials: "include",
    })
    const text = await res.text()
    let data: JsonObject | null = null
    try {
      data = asObject(JSON.parse(text))
    } catch {
      data = null
    }

    if (res.ok && data) {
      const task = asObject(data.task)
      const taskId = String(task?.id ?? "")
      const message = `已创建重试任务 ${taskId}`
      setTestdataTaskResult({ type: "success", message })
      toast.success("已重试测试数据生成任务", { description: message })
      await loadTestdataResources()
      if (taskId) {
        setSelectedTestdataTaskId(taskId)
      }
    } else {
      const message = data?.error ? String(data.error) : text || res.statusText
      setTestdataTaskResult({ type: "error", message })
      toast.error("任务重试失败", { description: message })
    }

    setTestdataTaskCreating(false)
  }

  const downloadSelectedTestdataPackage = () => {
    if (!selectedTestdataTaskId) return
    window.open(`/api/admin/testdata-generation-tasks/${selectedTestdataTaskId}/package`, "_blank", "noopener,noreferrer")
  }

  const addSolution = async () => {
    await fetch(`/api/admin/problems/${problemId}/solutions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: solutionTitle,
        summary: solutionSummary || undefined,
        content: solutionContent,
        type: "official",
        visibility: solutionVisibility,
        accessLevel: solutionAccessLevel,
        isPremium: solutionIsPremium,
        versionId: selectedVersionId || undefined,
        videoUrl: solutionVideoUrl || undefined,
      }),
    })
    setSolutionTitle("")
    setSolutionSummary("")
    setSolutionContent("")
    setSolutionVideoUrl("")
    setSolutionVisibility("public")
    setSolutionAccessLevel("FREE")
    setSolutionIsPremium(false)
    await load()
  }

  const syncHustoj = async () => {
    if (!problemId) return
    const res = await fetch(`/api/admin/problems/${problemId}/sync-hustoj`, {
      method: "POST",
      credentials: "include",
    })
    setSyncResult(await res.text())
  }

  return (
    <div className="container py-8 px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题目详情</h1>
          <p className="text-muted-foreground mt-2">{problemId}</p>
        </div>
        <Link href="/admin/problems">
          <Button variant="secondary">返回列表</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">题目基础信息</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{getProblemStatusLabel(problem?.status ?? 0)}</Badge>
                <Badge variant="outline">{problem?.visibility ?? visibility}</Badge>
                <Badge variant="outline">{problem?.visible ? "visible" : "hidden"}</Badge>
                <Badge variant="outline">{problem?.defunct === "Y" ? "defunct=Y" : "defunct=N"}</Badge>
              </div>
            </div>
            <Button onClick={saveProblemMeta} disabled={problemSaving}>
              {problemSaving ? "保存中..." : "保存基础信息"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="题目标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              placeholder="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>

          <Input
            placeholder="题号别名，逗号分隔，如：P1001, luogu1"
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="难度"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ProblemMeta["visibility"])}
            >
              <option value="public">public</option>
              <option value="contest">contest</option>
              <option value="private">private</option>
              <option value="hidden">hidden</option>
            </select>
            <Input
              placeholder="来源 source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <div>当前版本 ID：{problem?.currentVersionId ?? "-"}</div>
            <div>版本号：{problem?.version ?? "-"}</div>
            <div>发布时间：{problem?.publishedAt ? new Date(problem.publishedAt).toLocaleString() : "-"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">题目标签</h2>
            <Button onClick={saveTags} disabled={tagsSaving}>
              {tagsSaving ? "保存中..." : "保存标签"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            选择语言/数据结构/算法标签。Scratch 题请选：scratch-必做 或 scratch-可选；普通代码题请保留 C++ / Python。只有双轨题才同时带 Scratch 和代码语言标签。
          </div>
          <TagGroup title="语言标签" tags={languageTags} selected={selectedTags} onToggle={toggleTag} />
          <TagGroup title="数据结构" tags={dataStructureTags} selected={selectedTags} onToggle={toggleTag} />
          <TagGroup title="算法标签" tags={algorithmTags} selected={selectedTags} onToggle={toggleTag} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">题型工作流</h2>
              <div className="text-xs text-muted-foreground">
                后台会按标签和当前版本语言配置，自动把 Scratch 题与代码题的管理区分开。
              </div>
            </div>
            <Badge variant="outline">{getProblemModeLabel(problemMode)}</Badge>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            {getProblemModeDescription(problemMode)}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">代码题工作流</div>
              <div className="mt-2 font-medium">{supportsCodeWorkflow ? "启用" : "关闭"}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Judge 配置、标程上传、自动造数据、测试点管理、HUSTOJ 同步。
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Scratch 工作流</div>
              <div className="mt-2 font-medium">{supportsScratchWorkflow ? "启用" : "关闭"}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Scratch 规则生成、规则 JSON 维护、上传 Scratch 答案验证。
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">当前版本现状</div>
              <div className="mt-2 font-medium">
                代码语言 {codeJudgeConfigEntries.length} 个 · Scratch 语言 {scratchJudgeConfigEntries.length} 个
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                这里显示的是当前版本配置，不再把 Scratch 语言和 C++/Python 放在同一个编辑表单里。
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">新增版本</h2>
          <Tabs
            value={statementEditorMode}
            onValueChange={(value) => setStatementEditorMode(value as "edit" | "preview")}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                这里输入的题面会同时写入 `statement` 和 `statementMd`。支持 Markdown 与公式。
              </div>
              <TabsList>
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="edit" className="mt-0">
              <textarea
                className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="题目描述 statement / statementMd"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-0">
              <div className="min-h-[220px] rounded-md border border-input bg-background p-4">
                {statement.trim() ? (
                  <ProblemMarkdown markdown={statement} />
                ) : (
                  <div className="text-sm text-muted-foreground">暂无题面内容。</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <div className="grid md:grid-cols-2 gap-3">
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="输入格式 inputFormat"
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
            />
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="输出格式 outputFormat"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
            />
          </div>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="约束 constraints"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder='样例 JSON，例如 [{"input":"1","output":"2"}]'
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
          />
          {samplePreview.error ? (
            <div className="text-xs text-red-400">
              样例 JSON 解析失败：{samplePreview.error}
            </div>
          ) : null}
          <div className="grid md:grid-cols-2 gap-3">
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="提示 hints"
              value={hints}
              onChange={(e) => setHints(e.target.value)}
            />
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="备注 notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="时间限制 ms"
              value={timeLimitMs}
              onChange={(e) => setTimeLimitMs(e.target.value)}
            />
            <Input
              placeholder="内存限制 MB"
              value={memoryLimitMb}
              onChange={(e) => setMemoryLimitMb(e.target.value)}
            />
          </div>
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">版本预览</h3>
                <div className="text-xs text-muted-foreground">
                  这里只预览本次新增版本，不读取数据库里的旧版本。
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                时限 {timeLimitMs || "1000"} ms · 内存 {memoryLimitMb || "256"} MB
              </div>
            </div>

            {!hasDraftVersionPreview ? (
              <div className="text-sm text-muted-foreground">
                填写上面的版本字段后，这里会显示完整预览。
              </div>
            ) : (
              <div className="space-y-4">
                {statement.trim() ? (
                  <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
                    <div className="text-sm font-medium text-foreground">题目描述</div>
                    <ProblemMarkdown markdown={statement} />
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <PreviewField title="输入格式" content={inputFormat} />
                  <PreviewField title="输出格式" content={outputFormat} />
                  <PreviewField title="约束条件" content={constraints} />
                  <PreviewField title="提示" content={hints} />
                  <PreviewField title="备注" content={notes} />
                </div>

                {samplePreview.error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
                    样例暂时无法预览：{samplePreview.error}
                  </div>
                ) : samplePreview.items.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">样例预览</div>
                    {samplePreview.items.map((sample, index) => (
                      <SamplePreviewCard
                        key={`${sample.input}-${sample.output}-${index}`}
                        sample={sample}
                        index={index}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <Button onClick={createVersion}>创建版本</Button>
        </CardContent>
      </Card>

      {supportsCodeWorkflow ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">代码题 Judge 配置</h2>
                <div className="text-xs text-muted-foreground">
                  这里只维护 C++ / Python 等标准输入输出语言。Scratch 轨道的配置会放到下面的 Scratch 专区单独处理。
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={addJudgeConfig} disabled={!selectedVersionId}>
                  新增语言
                </Button>
                <Button onClick={saveJudgeConfigs} disabled={!selectedVersionId || judgeConfigsSaving}>
                  {judgeConfigsSaving ? "保存中..." : "保存 Judge 配置"}
                </Button>
              </div>
            </div>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              <option value="">选择版本</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>

            {supportsScratchWorkflow && scratchJudgeConfigEntries.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                当前版本另外还有 {scratchJudgeConfigEntries.length} 个 Scratch 语言配置，它们不会在这里和代码语言混编编辑。
              </div>
            ) : null}

            {!selectedVersionId ? (
              <div className="text-sm text-muted-foreground">请先选择版本。</div>
            ) : codeJudgeConfigEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">当前版本还没有代码题 Judge 配置。</div>
            ) : (
              <div className="space-y-4">
                {codeJudgeConfigEntries.map(({ config, index }, renderIndex) => (
                  <div key={`${selectedVersionId}-${index}`} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">语言配置 #{renderIndex + 1}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeJudgeConfig(index)}
                      >
                        删除
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <select
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={config.language}
                        onChange={(e) => updateJudgeConfig(index, { language: e.target.value })}
                      >
                        {JUDGE_LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="judgeMode"
                        value={config.judgeMode}
                        onChange={(e) => updateJudgeConfig(index, { judgeMode: e.target.value })}
                      />
                      <Input
                        placeholder="timeLimitMs"
                        value={config.timeLimitMs}
                        onChange={(e) => updateJudgeConfig(index, { timeLimitMs: e.target.value })}
                      />
                      <Input
                        placeholder="memoryLimitMb"
                        value={config.memoryLimitMb}
                        onChange={(e) => updateJudgeConfig(index, { memoryLimitMb: e.target.value })}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => applyJudgeConfigPreset(index, config.language)}
                      >
                        套用预设
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        切换语言后可点击“套用预设”自动填充 judgeMode 与模板代码。
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Input
                        placeholder="entrypoint"
                        value={config.entrypoint}
                        onChange={(e) => updateJudgeConfig(index, { entrypoint: e.target.value })}
                      />
                      <Input
                        placeholder="entrySignature"
                        value={config.entrySignature}
                        onChange={(e) => updateJudgeConfig(index, { entrySignature: e.target.value })}
                      />
                      <Input
                        placeholder="sortOrder"
                        value={config.sortOrder}
                        onChange={(e) => updateJudgeConfig(index, { sortOrder: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        placeholder="compileCommand"
                        value={config.compileCommand}
                        onChange={(e) => updateJudgeConfig(index, { compileCommand: e.target.value })}
                      />
                      <Input
                        placeholder="runCommand"
                        value={config.runCommand}
                        onChange={(e) => updateJudgeConfig(index, { runCommand: e.target.value })}
                      />
                    </div>

                    <Input
                      placeholder="templateCodeUri"
                      value={config.templateCodeUri}
                      onChange={(e) => updateJudgeConfig(index, { templateCodeUri: e.target.value })}
                    />

                    <textarea
                      className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                      placeholder="templateCode"
                      value={config.templateCode}
                      onChange={(e) => updateJudgeConfig(index, { templateCode: e.target.value })}
                    />

                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.isEnabled}
                          onChange={(e) => updateJudgeConfig(index, { isEnabled: e.target.checked })}
                        />
                        启用
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.isDefault}
                          onChange={(e) => {
                            if (!e.target.checked) return
                            setJudgeConfigsDraft((prev) =>
                              prev.map((item, itemIndex) => ({
                                ...item,
                                isDefault: itemIndex === index,
                              }))
                            )
                          }}
                        />
                        默认语言
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {supportsCodeWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">代码题自动测试数据生成</h2>
              <div className="text-xs text-muted-foreground">
                推荐做法是直接上传标程，然后让系统按题面、标签和答案代码自动识别题型并生成测试点。
                当前自动模式优先支持 array / string / intervals / queries / grid_queries。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
              >
                <option value="">选择版本</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                onClick={() => void loadTestdataResources()}
                disabled={!selectedVersionId || testdataTaskRefreshing}
              >
                {testdataTaskRefreshing ? "刷新中..." : "刷新任务"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="text-sm font-medium">0. 推荐流程：上传标程并自动生成测试点</div>
              <div className="text-xs text-muted-foreground">
                你只需要上传正确答案代码，手动填写测试点个数。系统会结合题目标签、题面、输入格式和标程代码，自动识别题型并估算测试点范围，再直接创建生成任务。
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={standardSolutionLanguage}
                  onChange={(e) => setStandardSolutionLanguage(e.target.value)}
                >
                  <option value="cpp17">C++17</option>
                  <option value="cpp14">C++14</option>
                  <option value="cpp11">C++11</option>
                  <option value="python">Python</option>
                </select>
                <Input
                  placeholder="标程名称（可选）"
                  value={standardSolutionLabel}
                  onChange={(e) => setStandardSolutionLabel(e.target.value)}
                />
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={standardSolutionIsPrimary}
                    onChange={(e) => setStandardSolutionIsPrimary(e.target.checked)}
                  />
                  设为默认标程
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,1fr))]">
                <input
                  type="file"
                  accept=".cpp,.cc,.cxx,.py,.txt"
                  onChange={(e) => setStandardSolutionFile(e.target.files?.[0] ?? null)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <Input
                  placeholder="测试点个数"
                  value={testdataTaskCaseCount}
                  onChange={(e) => setTestdataTaskCaseCount(e.target.value)}
                />
                <Input
                  placeholder="总分（默认 100）"
                  value={testdataTaskTotalScore}
                  onChange={(e) => setTestdataTaskTotalScore(e.target.value)}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={testdataTaskMode}
                  onChange={(e) =>
                    setTestdataTaskMode(
                      e.target.value as "APPEND" | "REPLACE_GENERATED" | "REPLACE_ALL"
                    )
                  }
                >
                  <option value="REPLACE_GENERATED">替换自动生成测试点</option>
                  <option value="APPEND">追加</option>
                  <option value="REPLACE_ALL">替换全部测试点</option>
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  placeholder="随机种子（可选）"
                  value={testdataTaskSeed}
                  onChange={(e) => setTestdataTaskSeed(e.target.value)}
                />
                <Button
                  onClick={uploadSolutionAndAutoGenerateTestdata}
                  disabled={
                    !selectedVersionId ||
                    autoTestdataBusy ||
                    (!standardSolutionFile && !selectedStandardSolutionId)
                  }
                >
                  {autoTestdataBusy ? "自动生成中..." : "上传标程并自动生成测试点"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                如果不重新上传文件，系统会使用当前选中的已有标程；测试点范围由系统自动估算，当前只要求你填写测试点个数。
              </div>
              {testdataAnalysisResult?.recommendations.primaryGenerator ? (
                <div className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  当前自动识别：
                  <span className="ml-1 text-foreground">
                    {testdataAnalysisResult.recommendations.primaryGenerator.type}
                  </span>
                  <span className="ml-2">
                    置信度 {Math.round(testdataAnalysisResult.recommendations.primaryGenerator.score * 100)}%
                  </span>
                </div>
              ) : null}
              {autoTestdataResult && (
                <div
                  className={`text-xs break-all ${
                    autoTestdataResult.type === "success"
                      ? "text-emerald-400"
                      : autoTestdataResult.type === "error"
                        ? "text-red-400"
                        : "text-amber-400"
                  }`}
                >
                  {autoTestdataResult.message}
                </div>
              )}
            </div>

            <div className="text-sm font-medium">1. 高级配置（可选）</div>
            <div className="text-xs text-muted-foreground">
              如果自动流程生成的范围或分组不符合预期，再手动改这里的 JSON。正常使用优先走上面的自动模式。
            </div>
            <textarea
              className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder="可选：在这里粘贴 testdataGenerationConfig JSON"
              value={testdataConfigText}
              onChange={(e) => {
                setTestdataConfigText(e.target.value)
                setTestdataConfigDirty(true)
              }}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={analyzeTestdataGenerationConfig}
                disabled={!selectedVersionId || testdataAnalysisLoading || testdataConfigSaving}
              >
                {testdataAnalysisLoading ? "分析中..." : "分析题目生成草稿"}
              </Button>
              <Button
                onClick={saveTestdataGenerationConfig}
                disabled={!selectedVersionId || !testdataConfigText.trim() || testdataConfigSaving}
              >
                {testdataConfigSaving ? "保存中..." : "保存测试数据生成配置"}
              </Button>
            </div>
            {testdataConfigResult && (
              <div
                className={`text-xs break-all ${
                  testdataConfigResult.type === "success"
                    ? "text-emerald-400"
                    : testdataConfigResult.type === "error"
                      ? "text-red-400"
                      : "text-amber-400"
                }`}
              >
                {testdataConfigResult.message}
              </div>
            )}
            {testdataAnalysisResult ? (
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="font-medium">分析结果</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  主推荐 generator：
                  <span className="ml-1 text-foreground">
                    {testdataAnalysisResult.recommendations.primaryGenerator?.type ?? "未识别"}
                  </span>
                  {typeof testdataAnalysisResult.recommendations.primaryGenerator?.score === "number" ? (
                    <span className="ml-2">
                      置信度 {Math.round(testdataAnalysisResult.recommendations.primaryGenerator.score * 100)}%
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  题型：{testdataAnalysisResult.summary.problemCategory.join(" / ") || "未识别"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  输入结构：{testdataAnalysisResult.summary.inputStructures.join(" / ") || "未识别"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  风险点：{testdataAnalysisResult.summary.likelyPitfalls.join(" / ") || "无"}
                </div>
                {testdataAnalysisResult.reviewRequired ? (
                  <div className="mt-2 text-xs text-amber-400">该草稿建议人工复核后再保存。</div>
                ) : null}
                {testdataAnalysisResult.warnings.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-amber-400">
                    {testdataAnalysisResult.warnings.slice(0, 4).map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="text-sm font-medium">2. 单独上传 / 切换标程（可选）</div>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={standardSolutionLanguage}
                onChange={(e) => setStandardSolutionLanguage(e.target.value)}
              >
                <option value="cpp17">C++17</option>
                <option value="cpp14">C++14</option>
                <option value="cpp11">C++11</option>
                <option value="python">Python</option>
              </select>
              <Input
                placeholder="标程名称（可选）"
                value={standardSolutionLabel}
                onChange={(e) => setStandardSolutionLabel(e.target.value)}
              />
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={standardSolutionIsPrimary}
                  onChange={(e) => setStandardSolutionIsPrimary(e.target.checked)}
                />
                设为默认标程
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
              <input
                type="file"
                accept=".cpp,.cc,.cxx,.py,.txt"
                onChange={(e) => setStandardSolutionFile(e.target.files?.[0] ?? null)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <Button
                onClick={uploadStandardSolution}
                disabled={!selectedVersionId || !standardSolutionFile || standardSolutionUploading}
              >
                {standardSolutionUploading ? "上传中..." : "上传标程"}
              </Button>
            </div>
            {standardSolutionResult && (
              <div
                className={`text-xs break-all ${
                  standardSolutionResult.type === "success"
                    ? "text-emerald-400"
                    : standardSolutionResult.type === "error"
                      ? "text-red-400"
                      : "text-amber-400"
                }`}
              >
                {standardSolutionResult.message}
              </div>
            )}
            {standardSolutions.length > 0 ? (
              <div className="space-y-2">
                {standardSolutions.map((solution) => (
                  <label
                    key={solution.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="selected-standard-solution"
                        checked={selectedStandardSolutionId === solution.id}
                        onChange={() => setSelectedStandardSolutionId(solution.id)}
                      />
                      <div>
                        <div className="font-medium">
                          {solution.label} · {solution.language}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {solution.sourceAsset?.fileName ?? solution.id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {solution.isPrimary ? <Badge variant="outline">default</Badge> : null}
                      <Badge variant="outline">{solution.status}</Badge>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">当前版本还没有标程。</div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="text-sm font-medium">3. 手动创建生成任务（高级）</div>
            <div className="text-xs text-muted-foreground">
              如果你不想走上面的推荐自动流程，也可以在选定标程后手动创建任务。
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={testdataTaskMode}
                onChange={(e) =>
                  setTestdataTaskMode(
                    e.target.value as "APPEND" | "REPLACE_GENERATED" | "REPLACE_ALL"
                  )
                }
              >
                <option value="REPLACE_GENERATED">替换自动生成测试点</option>
                <option value="APPEND">追加</option>
                <option value="REPLACE_ALL">替换全部测试点</option>
              </select>
              <Input
                placeholder="测试点个数"
                value={testdataTaskCaseCount}
                onChange={(e) => setTestdataTaskCaseCount(e.target.value)}
              />
              <Input
                placeholder="总分（平分）"
                value={testdataTaskTotalScore}
                onChange={(e) => setTestdataTaskTotalScore(e.target.value)}
              />
              <Input
                placeholder="随机种子（可选）"
                value={testdataTaskSeed}
                onChange={(e) => setTestdataTaskSeed(e.target.value)}
              />
            </div>
            <Button
              onClick={createTestdataGenerationTask}
              disabled={!selectedVersionId || !selectedStandardSolutionId || testdataTaskCreating}
            >
              {testdataTaskCreating ? "创建中..." : "自动创建生成任务"}
            </Button>
            {testdataTaskResult && (
              <div
                className={`text-xs break-all ${
                  testdataTaskResult.type === "success"
                    ? "text-emerald-400"
                    : testdataTaskResult.type === "error"
                      ? "text-red-400"
                      : "text-amber-400"
                }`}
              >
                {testdataTaskResult.message}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="space-y-3">
              <div className="text-sm font-medium">任务列表</div>
              {!selectedVersionId ? (
                <div className="text-sm text-muted-foreground">请先选择版本。</div>
              ) : testdataTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">当前版本暂无生成任务。</div>
              ) : (
                testdataTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedTestdataTaskId === task.id
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-border/70 bg-muted/10 hover:border-border"
                    }`}
                    onClick={() => setSelectedTestdataTaskId(task.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{task.id.slice(0, 12)}</div>
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {task.stage} · {task.mode}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      计划 {task.plannedCaseCount} · 成功 {task.succeededCaseCount} · 写入 {task.persistedCaseCount}
                    </div>
                    {task.errorMessage ? (
                      <div className="mt-2 text-xs text-red-400 break-all">{task.errorMessage}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium">任务详情</div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => void loadTestdataResources()}
                    disabled={!selectedVersionId || testdataTaskRefreshing}
                  >
                    {testdataTaskRefreshing ? "刷新中..." : "刷新"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={downloadSelectedTestdataPackage}
                    disabled={!selectedTestdataTaskId || selectedTestdataTask?.status !== "SUCCEEDED"}
                  >
                    下载数据包
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={retrySelectedTestdataTask}
                    disabled={
                      !selectedTestdataTaskId ||
                      testdataTaskCreating ||
                      (selectedTestdataTask?.status !== "FAILED" &&
                        selectedTestdataTask?.status !== "CANCELLED")
                    }
                  >
                    重试任务
                  </Button>
                </div>
              </div>

              {!selectedTestdataTaskId ? (
                <div className="text-sm text-muted-foreground">请选择一个任务查看详情。</div>
              ) : testdataTaskLoading ? (
                <div className="text-sm text-muted-foreground">任务加载中...</div>
              ) : !selectedTestdataTask ? (
                <div className="text-sm text-muted-foreground">任务详情不可用。</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">状态</div>
                      <div className="mt-1 font-medium">
                        {selectedTestdataTask.status} / {selectedTestdataTask.stage}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">标程</div>
                      <div className="mt-1 font-medium">
                        {selectedTestdataTask.standardSolution?.label ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">统计</div>
                      <div className="mt-1 font-medium">
                        {selectedTestdataTask.succeededCaseCount}/{selectedTestdataTask.plannedCaseCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">写入测试点</div>
                      <div className="mt-1 font-medium">{selectedTestdataTask.persistedCaseCount}</div>
                    </div>
                  </div>

                  {selectedTestdataTask.packageAsset?.fileName ? (
                    <div className="text-xs text-muted-foreground">
                      已缓存数据包：{selectedTestdataTask.packageAsset.fileName}
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 rounded-lg border border-border/70 p-4">
                      <div className="text-sm font-medium">执行日志</div>
                      {testdataTaskLogs.length === 0 ? (
                        <div className="text-sm text-muted-foreground">暂无日志。</div>
                      ) : (
                        <div className="space-y-2">
                          {testdataTaskLogs.slice(-12).map((log) => (
                            <div key={log.id} className="rounded-md bg-muted/20 p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  #{log.sequenceNo} · {log.level} · {log.stage}
                                </span>
                                <span className="text-muted-foreground">{log.code ?? "-"}</span>
                              </div>
                              <div className="mt-1 break-all">{log.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 p-4">
                      <div className="text-sm font-medium">生成结果</div>
                      {testdataTaskCases.length === 0 ? (
                        <div className="text-sm text-muted-foreground">暂无 case。</div>
                      ) : (
                        <div className="space-y-2">
                          {testdataTaskCases.slice(0, 12).map((item) => (
                            <div key={item.id} className="rounded-md bg-muted/20 p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  #{item.ordinal} · {item.groupKey ?? "-"} · {item.status}
                                </span>
                                <span>{item.executionStatus}</span>
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                score {item.score}
                                {item.expectedOutputAsset?.fileName
                                  ? ` · ${item.expectedOutputAsset.fileName}`
                                  : ""}
                              </div>
                              {item.errorMessage ? (
                                <div className="mt-1 text-red-400 break-all">{item.errorMessage}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {supportsCodeWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">代码题测试点录入</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              <option value="">选择版本</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
            <Input
              placeholder="分组 groupId"
              value={tcGroup}
              onChange={(e) => setTcGroup(e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="分数 score"
              value={tcScore}
              onChange={(e) => setTcScore(e.target.value)}
            />
            <Input
              placeholder="顺序 orderIndex"
              value={tcOrder}
              onChange={(e) => setTcOrder(e.target.value)}
            />
          </div>
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <input
              type="checkbox"
              checked={tcIsSample}
              onChange={(e) => setTcIsSample(e.target.checked)}
            />
            设为样例
          </label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="输入 input"
            value={tcInput}
            onChange={(e) => setTcInput(e.target.value)}
          />
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="输出 output"
            value={tcOutput}
            onChange={(e) => setTcOutput(e.target.value)}
          />
          <Button onClick={addTestcase}>添加测试点</Button>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={uploadZip}
              disabled={!zipFile || !problemId || zipUploading}
            >
              {zipUploading ? "上传中..." : "上传ZIP测试样例"}
            </Button>
          </div>
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <input
              type="checkbox"
              checked={skipZipSync}
              onChange={(e) => setSkipZipSync(e.target.checked)}
            />
            跳过 HUSTOJ 同步，只更新本地题库测试点
          </label>
          <div className="text-xs text-muted-foreground">
            ZIP命名为 {problemId}.zip，内部文件为 *1.in / *1.out 成对编号。
            可选附带 config.yml/config.yaml（key 使用对应的 *.in 文件名），支持 timeLimit、memoryLimit、score、isPretest、subtaskId。
            将覆盖最新版本测试点。
          </div>
          {zipResult && (
            <div
              className={`text-xs break-all ${
                zipResult.type === "success"
                  ? "text-emerald-400"
                  : zipResult.type === "error"
                    ? "text-red-400"
                    : "text-amber-400"
              }`}
            >
              {zipResult.message}
            </div>
          )}
          {zipWarnings.length > 0 && (
            <div className="text-xs text-amber-400 space-y-1">
              {zipWarnings.slice(0, 6).map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
              {zipWarnings.length > 6 && (
                <div>…另外 {zipWarnings.length - 6} 条警告</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {supportsCodeWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">代码题测试点管理</h2>
              <div className="text-xs text-muted-foreground">
                可直接编辑 sample / hidden / stress、分组、顺序、分值和可见性。
              </div>
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              <option value="">选择版本</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
          </div>

          {!selectedVersionId ? (
            <div className="text-sm text-muted-foreground">请先选择版本。</div>
          ) : editableTestcases.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前版本暂无测试点。</div>
          ) : (
            <div className="space-y-3">
              {editableTestcases.map((testcase) => (
                <div key={testcase.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-5">
                    <Input
                      placeholder="title"
                      value={testcase.title}
                      onChange={(e) => updateEditableTestcase(testcase.id, { title: e.target.value })}
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={String(testcase.caseType)}
                      onChange={(e) => applyEditableCaseType(testcase.id, Number(e.target.value))}
                    >
                      <option value="0">样例</option>
                      <option value="1">隐藏</option>
                      <option value="2">压力</option>
                    </select>
                    <Input
                      placeholder="score"
                      value={testcase.score}
                      onChange={(e) => updateEditableTestcase(testcase.id, { score: e.target.value })}
                    />
                    <Input
                      placeholder="groupId"
                      value={testcase.groupId}
                      onChange={(e) => updateEditableTestcase(testcase.id, { groupId: e.target.value })}
                    />
                    <Input
                      placeholder="orderIndex"
                      value={testcase.orderIndex}
                      onChange={(e) => updateEditableTestcase(testcase.id, { orderIndex: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <Badge variant="outline">{getCaseTypeLabel(testcase.caseType, testcase.isSample)}</Badge>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={testcase.visible}
                        onChange={(e) => updateEditableTestcase(testcase.id, { visible: e.target.checked })}
                      />
                      visible
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={testcase.isSample}
                        onChange={(e) =>
                          applyEditableCaseType(testcase.id, e.target.checked ? 0 : 1)
                        }
                      />
                      sample
                    </label>
                    <span className="text-xs text-muted-foreground">{testcase.id}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveEditableTestcase(testcase)}
                      disabled={testcaseSavingId === testcase.id}
                    >
                      {testcaseSavingId === testcase.id ? "保存中..." : "保存测试点"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteEditableTestcase(testcase.id)}
                      disabled={testcaseDeletingId === testcase.id}
                    >
                      {testcaseDeletingId === testcase.id ? "删除中..." : "删除"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {supportsScratchWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Scratch 评测规则生成</h2>
          <div className="text-xs text-muted-foreground">
            上传标准答案的 Scratch 项目（.sb3 / project.json）或批量 ZIP（可选附带 config.yml/config.yaml/config.json）。
            批量 ZIP 未提供配置时，会按文件名中的分值约定自动识别（如 10-step1.sb3、step2_20.sb3）。
            若不选版本，默认写入最新版本；可指定角色名（不填则自动选择第一个非舞台角色）。
            如果题目题干能识别出 Scratch 要求点，上传标准答案后会优先按题干自动生成或复用草稿，再补全成完整的多角色分段判题规则。
            角色名 / 分值 / 追加模式主要用于旧的单角色规则或批量 ZIP 导入。
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              <option value="">选择版本（可选）</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version}
                </option>
              ))}
            </select>
            <Input
              placeholder="角色名（可选）"
              value={scratchRole}
              onChange={(e) => setScratchRole(e.target.value)}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="分值（单文件得分点 / 批量默认分值）"
              value={scratchRuleScore}
              onChange={(e) => setScratchRuleScore(e.target.value)}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={scratchRuleMode}
              onChange={(e) => setScratchRuleMode(e.target.value as "append" | "replace")}
            >
              <option value="replace">覆盖（推荐）</option>
              <option value="append">追加</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="file"
              accept=".sb3,.json,.zip"
              onChange={(e) => setScratchRuleFile(e.target.files?.[0] ?? null)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={generateScratchRules}
              disabled={!scratchRuleFile || scratchRuleGenerating}
            >
              {scratchRuleGenerating ? "生成中..." : "生成 Scratch 规则"}
            </Button>
          </div>
          {scratchRuleResult && (
            <div
              className={`text-xs break-all ${
                scratchRuleResult.type === "success"
                  ? "text-emerald-400"
                  : scratchRuleResult.type === "error"
                    ? "text-red-400"
                    : "text-amber-400"
              }`}
            >
              {scratchRuleResult.message}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {supportsScratchWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Scratch 规则 JSON / 验证</h2>
          <div className="text-xs text-muted-foreground">
            这里用于维护可复用的自定义 Scratch 判题 JSON。保存后会写入当前题目版本的
            <code className="mx-1">ProblemVersion.scratchRules</code>；新导入的 Scratch 题会先自动生成题干草稿 JSON，
            也可以先不保存，直接上传标准答案或样例答案进行验证。
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            <option value="">选择版本</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-[320px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="在这里粘贴 scratchRules JSON；留空表示清空该版本的 Scratch 规则。"
            value={scratchRulesText}
            onChange={(e) => {
              setScratchRulesText(e.target.value)
              setScratchRulesDirty(true)
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveScratchRulesJson} disabled={!selectedVersionId || scratchRulesSaving}>
              {scratchRulesSaving ? "保存中..." : "保存 Scratch 规则 JSON"}
            </Button>
          </div>
          {scratchRulesSaveResult && (
            <div
              className={`text-xs break-all ${
                scratchRulesSaveResult.type === "success"
                  ? "text-emerald-400"
                  : scratchRulesSaveResult.type === "error"
                    ? "text-red-400"
                    : "text-amber-400"
              }`}
            >
              {scratchRulesSaveResult.message}
            </div>
          )}
          <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
            <input
              type="file"
              accept=".sb3,.json"
              onChange={(e) => setScratchValidateFile(e.target.files?.[0] ?? null)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={validateScratchRulesJson}
              disabled={!selectedVersionId || !scratchValidateFile || scratchValidateRunning}
            >
              {scratchValidateRunning ? "验证中..." : "上传答案验证规则"}
            </Button>
          </div>
          {scratchValidateResult && (
            <div
              className={`text-xs break-all ${
                scratchValidateResult.type === "success"
                  ? "text-emerald-400"
                  : scratchValidateResult.type === "error"
                    ? "text-red-400"
                    : "text-amber-400"
              }`}
            >
              {scratchValidateResult.message}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">题解管理</h2>
          <Input
            placeholder="题解标题"
            value={solutionTitle}
            onChange={(e) => setSolutionTitle(e.target.value)}
          />
          <Input
            placeholder="题解摘要（免费可见）"
            value={solutionSummary}
            onChange={(e) => setSolutionSummary(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="题解内容"
            value={solutionContent}
            onChange={(e) => setSolutionContent(e.target.value)}
          />
          <Input
            placeholder="视频解析地址（可选）"
            value={solutionVideoUrl}
            onChange={(e) => setSolutionVideoUrl(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={solutionVisibility}
            onChange={(e) =>
              setSolutionVisibility(e.target.value as "public" | "vip" | "purchase" | "private")
            }
          >
            <option value="public">public</option>
            <option value="vip">vip</option>
            <option value="purchase">purchase</option>
            <option value="private">private</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={solutionAccessLevel}
            onChange={(e) =>
              setSolutionAccessLevel(
                e.target.value as "FREE" | "MEMBERSHIP" | "PURCHASE" | "MEMBERSHIP_OR_PURCHASE",
              )
            }
          >
            <option value="FREE">FREE</option>
            <option value="MEMBERSHIP">MEMBERSHIP</option>
            <option value="PURCHASE">PURCHASE</option>
            <option value="MEMBERSHIP_OR_PURCHASE">MEMBERSHIP_OR_PURCHASE</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={solutionIsPremium}
              onChange={(e) => setSolutionIsPremium(e.target.checked)}
            />
            标记为高级题解
          </label>
          <Button onClick={addSolution}>新增题解</Button>
          <div className="text-sm text-muted-foreground">
            现有题解：{solutions.length} 条
          </div>
        </CardContent>
      </Card>

      {supportsCodeWorkflow ? (
      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">代码题同步到 HUSTOJ</h2>
          <Button onClick={syncHustoj} disabled={!problemId}>立即同步</Button>
          <div className="text-xs text-muted-foreground break-all">
            {syncResult || `未同步 (problemId: ${problemId || "missing"})`}
          </div>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">版本列表</h2>
          {versions.map((v) => (
            <div key={v.id} className="border-b border-border pb-2">
              <div className="font-medium">
                v{v.version} · {v.testcases.length} 测试点
              </div>
              <div className="text-xs text-muted-foreground">
                {v.timeLimitMs}ms / {v.memoryLimitMb}MB
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(v.judgeConfigs ?? []).map((config) => (
                  <Badge key={config.id} variant="outline">
                    {config.language}
                    {config.isDefault ? " · default" : ""}
                    {config.judgeMode ? ` · ${config.judgeMode}` : ""}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  样例 {v.testcases.filter((tc) => tc.isSample || tc.caseType === 0).length}
                </span>
                <span>
                  隐藏 {v.testcases.filter((tc) => !tc.isSample && tc.caseType !== 0 && tc.caseType !== 2).length}
                </span>
                <span>
                  压力 {v.testcases.filter((tc) => tc.caseType === 2).length}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {v.testcases.slice(0, 6).map((tc) => (
                  <div key={tc.id}>
                    {tc.orderIndex ?? "-"} · {getCaseTypeLabel(tc.caseType, tc.isSample)} · score {tc.score}
                    {tc.groupId ? ` · group ${tc.groupId}` : ""}
                    {tc.title ? ` · ${tc.title}` : ""}
                  </div>
                ))}
                {v.testcases.length > 6 ? <div>…另外 {v.testcases.length - 6} 个测试点</div> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TagGroup({
  title,
  tags,
  selected,
  onToggle,
}: {
  title: string
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-zinc-200">{title}</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-zinc-700"
              }`}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
