"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type Version = {
  id: string
  version: number
  statement: string
  constraints?: string | null
  inputFormat?: string | null
  outputFormat?: string | null
  samples?: unknown
  notes?: string | null
  timeLimitMs: number
  memoryLimitMb: number
  testcases: {
    id: string
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

type ZipResult = {
  type: "success" | "error" | "info"
  message: string
}

export default function AdminProblemDetailPage() {
  const params = useParams<{ id?: string | string[] }>()
  const pathname = usePathname()
  const paramId = Array.isArray(params.id) ? params.id[0] : params.id ?? ""
  const pathId = pathname?.split("/").filter(Boolean).pop() ?? ""
  const problemId = paramId || pathId
  const [versions, setVersions] = React.useState<Version[]>([])
  const [solutions, setSolutions] = React.useState<Solution[]>([])
  const [statement, setStatement] = React.useState("")
  const [constraints, setConstraints] = React.useState("")
  const [inputFormat, setInputFormat] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState("")
  const [samples, setSamples] = React.useState("")
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
  const [scratchRuleFile, setScratchRuleFile] = React.useState<File | null>(null)
  const [scratchRole, setScratchRole] = React.useState("")
  const [scratchRuleScore, setScratchRuleScore] = React.useState("10")
  const [scratchRuleMode, setScratchRuleMode] = React.useState<"append" | "replace">("append")
  const [scratchRuleResult, setScratchRuleResult] = React.useState<ZipResult | null>(null)
  const [scratchRuleGenerating, setScratchRuleGenerating] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [tagsSaving, setTagsSaving] = React.useState(false)

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
      const pData = await pRes.json()
      if (Array.isArray(pData?.tags)) {
        setSelectedTags(pData.tags)
      }
    }

    const vRes = await fetch(`/api/admin/problems/${problemId}/versions`, {
      credentials: "include",
    })
    const vData = await vRes.json()
    setVersions(vData)
    if (vData[0]?.id) setSelectedVersionId(vData[0].id)

    const sRes = await fetch(`/api/admin/problems/${problemId}/solutions`, {
      credentials: "include",
    })
    const sData = await sRes.json()
    setSolutions(sData)
  }, [problemId])

  React.useEffect(() => {
    if (problemId) load()
  }, [problemId, load])

  const createVersion = async () => {
    const payload: Record<string, unknown> = {
      statement,
      constraints: constraints || undefined,
      inputFormat: inputFormat || undefined,
      outputFormat: outputFormat || undefined,
      notes: notes || undefined,
      timeLimitMs: Number(timeLimitMs || 1000),
      memoryLimitMb: Number(memoryLimitMb || 256),
    }
    if (samples) {
      try {
        payload.samples = JSON.parse(samples)
      } catch {
        payload.samples = []
      }
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
    setNotes("")
    await load()
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
    const res = await fetch(`/api/admin/problems/${problemId}/testcases-zip`, {
      method: "POST",
      credentials: "include",
      body: form,
    })
    const text = await res.text()
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }

    if (data) {
      if (res.ok) {
        const rawWarnings = Array.isArray(data.warnings) ? data.warnings : []
        const formattedWarnings = rawWarnings
          .map((warning: { code?: unknown; detail?: unknown } | null | undefined) => {
            const code =
              warning && typeof warning.code === "string" ? warning.code : "warning"
            const detail =
              warning?.detail !== undefined ? JSON.stringify(warning.detail) : ""
            return detail ? `${code}: ${detail}` : code
          })
          .filter(Boolean)
        if (formattedWarnings.length) {
          setZipWarnings(formattedWarnings)
        }
        const syncMsg = data.sync?.ok
          ? `已同步 HUSTOJ (id: ${data.sync.hustojProblemId})`
          : data.sync?.error
            ? `同步失败：${data.sync.error}`
            : "同步状态未知"
        const warningSummary = formattedWarnings.length
          ? ` 警告 ${formattedWarnings.length} 条`
          : ""
        const successMessage = `上传成功，写入 ${data.count ?? 0} 个测试点。${syncMsg}${warningSummary}`
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
        const rollback = data.rollback ? `，回滚：${data.rollback}` : ""
        const errorMessage = `上传失败 (${data.error ?? res.statusText})${detail}${rollback}`
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
    let data: any = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    if (res.ok && data) {
      const msg = `生成成功：版本 ${data.versionId}，角色 ${data.role}，脚本 ${data.scripts}，分值 ${data.score ?? scratchRuleScore}`
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
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="题目描述 statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
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
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="备注 notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
          <Button onClick={createVersion}>创建版本</Button>
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
          <h2 className="text-lg font-semibold">Scratch 评测规则生成</h2>
          <div className="text-xs text-muted-foreground">
            上传标准答案的 Scratch 项目（.sb3 或 project.json），自动生成规则并写入当前版本。
            若不选版本，默认写入最新版本。可指定角色名（不填则自动选择第一个非舞台角色）。
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
              placeholder="分值（该得分点）"
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
              accept=".sb3,.json"
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
