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
    orderIndex?: number | null
  }[]
}

type Solution = {
  id: string
  title: string
  type: string
  visibility: string
  createdAt: string
}

type ProblemMeta = {
  id: string
  slug: string
  title: string
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

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" ? (value as JsonObject) : null
}

function asInt(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback
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
  { value: "scratch-optional", label: "Scratch（可选）" },
  { value: "scratch-must", label: "Scratch（必做）" },
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
    case "scratch-optional":
      return {
        judgeMode: "scratch",
        templateCode: "",
      }
    case "scratch-must":
      return {
        judgeMode: "scratch",
        templateCode: "",
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
  const [solutionContent, setSolutionContent] = React.useState("")
  const [syncResult, setSyncResult] = React.useState("")
  const [zipFile, setZipFile] = React.useState<File | null>(null)
  const [zipResult, setZipResult] = React.useState<ZipResult | null>(null)
  const [zipWarnings, setZipWarnings] = React.useState<string[]>([])
  const [zipUploading, setZipUploading] = React.useState(false)
  const [skipZipSync, setSkipZipSync] = React.useState(true)
  const [scratchRuleFile, setScratchRuleFile] = React.useState<File | null>(null)
  const [scratchRole, setScratchRole] = React.useState("")
  const [scratchRuleScore, setScratchRuleScore] = React.useState("10")
  const [scratchRuleMode, setScratchRuleMode] = React.useState<"append" | "replace">("append")
  const [scratchRuleResult, setScratchRuleResult] = React.useState<ZipResult | null>(null)
  const [scratchRuleGenerating, setScratchRuleGenerating] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [tagsSaving, setTagsSaving] = React.useState(false)
  const [judgeConfigsDraft, setJudgeConfigsDraft] = React.useState<JudgeConfigDraft[]>([])
  const [judgeConfigsSaving, setJudgeConfigsSaving] = React.useState(false)
  const [editableTestcases, setEditableTestcases] = React.useState<EditableTestcaseDraft[]>([])
  const [testcaseSavingId, setTestcaseSavingId] = React.useState<string | null>(null)
  const [testcaseDeletingId, setTestcaseDeletingId] = React.useState<string | null>(null)

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
    setVersions(vData)
    setSelectedVersionId((current) =>
      current && vData.some((item: Version) => item.id === current)
        ? current
        : (vData[0]?.id ?? "")
    )

    const sRes = await fetch(`/api/admin/problems/${problemId}/solutions`, {
      credentials: "include",
    })
    const sData = await sRes.json()
    setSolutions(sData)
  }, [problemId])

  React.useEffect(() => {
    if (problemId) load()
  }, [problemId, load])

  const selectedVersion = React.useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? null,
    [selectedVersionId, versions]
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
      const msg = data.batch === true
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

  const addSolution = async () => {
    await fetch(`/api/admin/problems/${problemId}/solutions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: solutionTitle,
        content: solutionContent,
        type: "official",
        visibility: "public",
        versionId: selectedVersionId || undefined,
      }),
    })
    setSolutionTitle("")
    setSolutionContent("")
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
            选择语言/数据结构/算法标签。Scratch 题请选：scratch-必做 或 scratch-可选。
          </div>
          <TagGroup title="语言标签" tags={languageTags} selected={selectedTags} onToggle={toggleTag} />
          <TagGroup title="数据结构" tags={dataStructureTags} selected={selectedTags} onToggle={toggleTag} />
          <TagGroup title="算法标签" tags={algorithmTags} selected={selectedTags} onToggle={toggleTag} />
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Judge 配置</h2>
              <div className="text-xs text-muted-foreground">
                按版本维护语言、模板代码、入口签名、编译/运行命令和默认语言。
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

          {!selectedVersionId ? (
            <div className="text-sm text-muted-foreground">请先选择版本。</div>
          ) : judgeConfigsDraft.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前版本还没有 Judge 配置。</div>
          ) : (
            <div className="space-y-4">
              {judgeConfigsDraft.map((config, index) => (
                <div key={`${selectedVersionId}-${index}`} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">语言配置 #{index + 1}</div>
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">添加测试点</h2>
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">测试点管理</h2>
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Scratch 评测规则生成</h2>
          <div className="text-xs text-muted-foreground">
            上传标准答案的 Scratch 项目（.sb3 / project.json）或批量 ZIP（可选附带 config.yml/config.yaml/config.json）。
            批量 ZIP 未提供配置时，会按文件名中的分值约定自动识别（如 10-step1.sb3、step2_20.sb3）。
            若不选版本，默认写入最新版本；可指定角色名（不填则自动选择第一个非舞台角色）。
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
              <option value="append">追加（推荐）</option>
              <option value="replace">覆盖</option>
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

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">题解管理</h2>
          <Input
            placeholder="题解标题"
            value={solutionTitle}
            onChange={(e) => setSolutionTitle(e.target.value)}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="题解内容"
            value={solutionContent}
            onChange={(e) => setSolutionContent(e.target.value)}
          />
          <Button onClick={addSolution}>新增题解</Button>
          <div className="text-sm text-muted-foreground">
            现有题解：{solutions.length} 条
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">同步到 HUSTOJ</h2>
          <Button onClick={syncHustoj} disabled={!problemId}>立即同步</Button>
          <div className="text-xs text-muted-foreground break-all">
            {syncResult || `未同步 (problemId: ${problemId || "missing"})`}
          </div>
        </CardContent>
      </Card>

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
