"use client"

import * as React from "react"
import useSWR from "swr"
import {
  Binary,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  Loader2,
  Play,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProblemMarkdown } from "@/components/problems/problem-markdown"
import { ErrorState, LoadingState, StatePanel } from "@/components/patterns/state-panel"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { StatCard } from "@/components/patterns/stat-card"

type DataKitToolDefinition = {
  id: string
  kind: "generator" | "validator"
  fileName: string
  title: string
  description: string
  sampleParams: Record<string, string>
}

type DataKitDoc = {
  slug: string
  title: string
  markdown: string
}

type DataKitExample = {
  id: string
  title: string
  markdown: string
}

type DataKitOverviewResponse = {
  data: {
    rootPath: string
    compiler: string | null
    docs: DataKitDoc[]
    generators: DataKitToolDefinition[]
    validators: DataKitToolDefinition[]
    examples: DataKitExample[]
  }
}

type DataKitRunResponse = {
  data: {
    tool?: {
      id: string
      title: string
      fileName: string
    }
    command: string
    compiler?: string | null
    ok: boolean
    valid?: boolean
    exitCode: number | null
    stdout: string
    stderr: string
    truncated: boolean
  }
}

function stringifyParams(params: Record<string, string>) {
  return JSON.stringify(params, null, 2)
}

function parseParams(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("参数必须是 JSON 对象")
    }

    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      normalized[key] = String(value)
    }
    return normalized
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "参数 JSON 解析失败")
  }
}

function ResultPanel({
  title,
  result,
}: {
  title: string
  result: DataKitRunResponse["data"] | null
}) {
  if (!result) {
    return (
      <StatePanel
        icon={TerminalSquare}
        title={title}
        description="运行结果会显示在这里，适合先做小规模预览，再决定是否落到正式题目脚本里。"
      />
    )
  }

  return (
    <SectionCard
      title={title}
      description="工作台只做预览和校验，不替代正式的出题脚本与批量打包流程。"
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant={result.ok ? "default" : "destructive"}>{result.ok ? "运行成功" : "运行失败"}</Badge>
          {typeof result.valid === "boolean" ? (
            <Badge variant={result.valid ? "secondary" : "destructive"}>
              {result.valid ? "输入合法" : "输入不合法"}
            </Badge>
          ) : null}
          {result.truncated ? <Badge variant="outline">输出已截断</Badge> : null}
        </div>
      }
      contentClassName="space-y-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="surface-inset rounded-[1.35rem] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Command</p>
          <p className="mt-2 break-all text-sm text-foreground">{result.command}</p>
        </div>
        <div className="surface-inset rounded-[1.35rem] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Compiler / Exit</p>
          <p className="mt-2 text-sm text-foreground">
            {(result.compiler ?? "n/a")} · code {String(result.exitCode)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-inset rounded-[1.35rem] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">stdout</p>
          <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-all text-sm text-foreground">
            {result.stdout || "(empty)"}
          </pre>
        </div>
        <div className="surface-inset rounded-[1.35rem] p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">stderr</p>
          <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-all text-sm text-foreground">
            {result.stderr || "(empty)"}
          </pre>
        </div>
      </div>
    </SectionCard>
  )
}

export function DataKitWorkbenchPage() {
  const { data, error, isLoading, mutate } = useSWR<DataKitOverviewResponse>(
    "/admin/data-kit/overview",
    () => api.admin.dataKit.overview<DataKitOverviewResponse>(),
  )

  const [docSlug, setDocSlug] = React.useState("overview")
  const [generatorId, setGeneratorId] = React.useState("")
  const [generatorParams, setGeneratorParams] = React.useState("{}")
  const [validatorId, setValidatorId] = React.useState("")
  const [validatorParams, setValidatorParams] = React.useState("{}")
  const [validatorInput, setValidatorInput] = React.useState("5\n1 2 3 4 5\n")
  const [generatorBusy, setGeneratorBusy] = React.useState(false)
  const [validatorBusy, setValidatorBusy] = React.useState(false)
  const [selfTestBusy, setSelfTestBusy] = React.useState(false)
  const [generatorResult, setGeneratorResult] = React.useState<DataKitRunResponse["data"] | null>(null)
  const [validatorResult, setValidatorResult] = React.useState<DataKitRunResponse["data"] | null>(null)
  const [selfTestResult, setSelfTestResult] = React.useState<DataKitRunResponse["data"] | null>(null)

  React.useEffect(() => {
    if (!data?.data.generators.length || generatorId) return
    const first = data.data.generators[0]
    setGeneratorId(first.id)
    setGeneratorParams(stringifyParams(first.sampleParams))
  }, [data, generatorId])

  React.useEffect(() => {
    if (!data?.data.validators.length || validatorId) return
    const first = data.data.validators[0]
    setValidatorId(first.id)
    setValidatorParams(stringifyParams(first.sampleParams))
  }, [data, validatorId])

  const selectedDoc = data?.data.docs.find((doc) => doc.slug === docSlug) ?? data?.data.docs[0]
  const selectedGenerator = data?.data.generators.find((item) => item.id === generatorId) ?? data?.data.generators[0]
  const selectedValidator = data?.data.validators.find((item) => item.id === validatorId) ?? data?.data.validators[0]

  const runGenerator = async () => {
    if (!selectedGenerator) return
    try {
      setGeneratorBusy(true)
      const params = parseParams(generatorParams)
      const response = await api.admin.dataKit.generate<DataKitRunResponse>({
        tool: selectedGenerator.id,
        params,
      })
      setGeneratorResult(response.data)
      toast.success(`${selectedGenerator.title} 预览完成`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "生成器运行失败")
    } finally {
      setGeneratorBusy(false)
    }
  }

  const runValidator = async () => {
    if (!selectedValidator) return
    try {
      setValidatorBusy(true)
      const params = parseParams(validatorParams)
      const response = await api.admin.dataKit.validate<DataKitRunResponse>({
        tool: selectedValidator.id,
        params,
        input: validatorInput,
      })
      setValidatorResult(response.data)
      toast.success(response.data.valid ? "输入校验通过" : "输入未通过校验")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "校验器运行失败")
    } finally {
      setValidatorBusy(false)
    }
  }

  const runSelfTest = async () => {
    try {
      setSelfTestBusy(true)
      const response = await api.admin.dataKit.selfTest<DataKitRunResponse>()
      setSelfTestResult(response.data)
      toast.success(response.data.ok ? "自检通过" : "自检失败")
      mutate()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "自检执行失败")
    } finally {
      setSelfTestBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-wrap py-8 md:py-10">
        <LoadingState title="正在载入数据模板工作台" description="正在读取工具箱目录、文档和模板清单。" />
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="page-wrap py-8 md:py-10">
        <ErrorState
          title="数据模板工作台加载失败"
          description="请先确认 oi-icpc-data-kit 已经放在项目旁边，然后再刷新当前页面。"
          action={
            <Button variant="outline" onClick={() => mutate()}>
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin Data Kit"
          title="把 OI / ICPC 造数据模板、校验器和自检流程放进后台工作台。"
          description="这个页面只做模板预览、输入校验和整套工具箱自检，方便教研和题库管理员先验证 generator / validator，再落到正式题目的数据脚本里。"
          meta={
            <>
              <span>生成器</span>
              <span>·</span>
              <span>校验器</span>
              <span>·</span>
              <span>自检脚本</span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <Button onClick={runSelfTest} disabled={selfTestBusy}>
                {selfTestBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                运行整套自检
              </Button>
              <Button variant="secondary" onClick={() => mutate()}>
                刷新状态
              </Button>
            </div>
          }
          aside={
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Toolkit Root</p>
                <p className="mt-2 break-all text-sm text-foreground">{data.data.rootPath}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Compiler</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{data.data.compiler ?? "未检测到"}</p>
                </div>
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Docs</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{data.data.docs.length}</p>
                </div>
              </div>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Generators" value={data.data.generators.length} description="当前可直接预览的造数据模板" icon={FlaskConical} tone="primary" />
          <StatCard label="Validators" value={data.data.validators.length} description="当前可直接校验输入的模板" icon={CheckCircle2} tone="secondary" />
          <StatCard label="Examples" value={data.data.examples.length} description="示例题与说明文档" icon={FileCode2} tone="accent" />
          <StatCard label="Self Test" value={selfTestResult?.ok ? "通过" : "待运行"} description="整套工具链的本地自检状态" icon={Binary} tone="warning" />
        </div>

        <Tabs defaultValue="docs" className="space-y-6">
          <TabsList className="grid w-full gap-2 md:grid-cols-4">
            <TabsTrigger value="docs">文档</TabsTrigger>
            <TabsTrigger value="generate">生成器预览</TabsTrigger>
            <TabsTrigger value="validate">校验器预览</TabsTrigger>
            <TabsTrigger value="self-test">自检</TabsTrigger>
          </TabsList>

          <TabsContent value="docs" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
              <SectionCard title="文档导航" description="先看中文说明，再决定要用哪个模板起 generator。">
                <div className="space-y-2">
                  {data.data.docs.map((doc) => (
                    <Button
                      key={doc.slug}
                      variant={doc.slug === selectedDoc?.slug ? "default" : "secondary"}
                      className="w-full justify-start"
                      onClick={() => setDocSlug(doc.slug)}
                    >
                      {doc.title}
                    </Button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title={selectedDoc?.title ?? "工具箱文档"}
                description="这一页会直接渲染工具箱里的 Markdown，方便后台查阅。"
              >
                <ProblemMarkdown markdown={selectedDoc?.markdown ?? "暂无文档"} className="text-sm" />
              </SectionCard>
            </div>

            <SectionCard title="示例题" description="示例题目录已经接进后台，方便教研快速查看模板落地方式。">
              <div className="grid gap-4 lg:grid-cols-3">
                {data.data.examples.map((example) => (
                  <div key={example.id} className="surface-inset rounded-[1.35rem] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{example.title}</p>
                      <Badge variant="outline">{example.id}</Badge>
                    </div>
                    <div className="max-h-64 overflow-auto text-sm">
                      <ProblemMarkdown markdown={example.markdown} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="generate" className="space-y-6">
            <SectionCard
              title="生成器工作台"
              description="这里只做小规模预览。正式出题时，还是建议在题目目录里基于模板扩展本题专属 mode。"
              action={
                <Button onClick={runGenerator} disabled={generatorBusy || !selectedGenerator}>
                  {generatorBusy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  运行生成器
                </Button>
              }
              contentClassName="space-y-5"
            >
              <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">生成器模板</label>
                    <select
                      className="focus-ring ui-field h-11 px-3 text-sm"
                      value={selectedGenerator?.id ?? ""}
                      onChange={(event) => {
                        const next = data.data.generators.find((item) => item.id === event.target.value)
                        setGeneratorId(event.target.value)
                        if (next) setGeneratorParams(stringifyParams(next.sampleParams))
                      }}
                    >
                      {data.data.generators.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="surface-inset rounded-[1.35rem] p-4 text-sm">
                    <p className="font-semibold text-foreground">{selectedGenerator?.fileName}</p>
                    <p className="mt-2 leading-7 text-muted-foreground">{selectedGenerator?.description}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">参数 JSON</label>
                  <textarea
                    className="focus-ring ui-field min-h-[220px] px-4 py-3 font-mono text-sm"
                    value={generatorParams}
                    onChange={(event) => setGeneratorParams(event.target.value)}
                  />
                </div>
              </div>
            </SectionCard>

            <ResultPanel title="生成结果" result={generatorResult} />
          </TabsContent>

          <TabsContent value="validate" className="space-y-6">
            <SectionCard
              title="校验器工作台"
              description="用于快速验证输入格式是否符合你当前的约束设定，适合导入题前的抽样检查。"
              action={
                <Button onClick={runValidator} disabled={validatorBusy || !selectedValidator}>
                  {validatorBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  运行校验器
                </Button>
              }
              contentClassName="space-y-5"
            >
              <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">校验器模板</label>
                    <select
                      className="focus-ring ui-field h-11 px-3 text-sm"
                      value={selectedValidator?.id ?? ""}
                      onChange={(event) => {
                        const next = data.data.validators.find((item) => item.id === event.target.value)
                        setValidatorId(event.target.value)
                        if (next) setValidatorParams(stringifyParams(next.sampleParams))
                      }}
                    >
                      {data.data.validators.map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="surface-inset rounded-[1.35rem] p-4 text-sm">
                    <p className="font-semibold text-foreground">{selectedValidator?.fileName}</p>
                    <p className="mt-2 leading-7 text-muted-foreground">{selectedValidator?.description}</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">参数 JSON</label>
                    <textarea
                      className="focus-ring ui-field min-h-[160px] px-4 py-3 font-mono text-sm"
                      value={validatorParams}
                      onChange={(event) => setValidatorParams(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">待校验输入</label>
                    <textarea
                      className="focus-ring ui-field min-h-[200px] px-4 py-3 font-mono text-sm"
                      value={validatorInput}
                      onChange={(event) => setValidatorInput(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <ResultPanel title="校验结果" result={validatorResult} />
          </TabsContent>

          <TabsContent value="self-test" className="space-y-6">
            <SectionCard
              title="整套工具箱自检"
              description="会执行工具箱里的 scripts/self_test.sh，用来快速确认编译器、模板和校验器还都能跑。"
              action={
                <Button onClick={runSelfTest} disabled={selfTestBusy}>
                  {selfTestBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  执行自检
                </Button>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">建议用途</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    每次改 generator / validator 后先跑一次，避免把坏模板接进题库导入或测试数据流程。
                  </p>
                </div>
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">运行内容</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    编译 generators、validators，然后做一轮 smoke run，包括数组、树、图、最短路、字符串、网格、几何和流。
                  </p>
                </div>
              </div>
            </SectionCard>

            <ResultPanel title="自检输出" result={selfTestResult} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
