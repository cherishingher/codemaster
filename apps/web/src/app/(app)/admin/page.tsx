"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  AlertTriangle,
  BookOpenText,
  Database,
  Download,
  FlaskConical,
  Gauge,
  GraduationCap,
  LayoutPanelTop,
  Loader2,
  MessageSquareWarning,
  Package,
  Puzzle,
  ShieldAlert,
  Sparkles,
  WandSparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { OpsOverviewResponse } from "@/lib/ops-monitoring"
import { isAdminDevToolsVisible } from "@/lib/admin-dev"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { QueueTable } from "@/components/admin/queue-table"
import { AlertPanel } from "@/components/patterns/alert-panel"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { StatCard } from "@/components/patterns/stat-card"
import { StatusBadge } from "@/components/patterns/status-badge"

type ModerationListResponse = {
  data?: {
    items?: unknown[]
    total?: number
  }
}

const defaultPayload = {
  problems: [
    {
      title: "Sample Problem",
      difficulty: 3,
      visibility: "public",
      source: "import",
      tags: ["array", "hashmap"],
      versions: [
        {
          statement: "Describe the problem here.",
          constraints: "1 <= n <= 1e5",
          inputFormat: "n\\nnums...",
          outputFormat: "answer",
          samples: [{ input: "3\\n1 2 3", output: "6" }],
          notes: "Any notes",
          timeLimitMs: 1000,
          memoryLimitMb: 256,
          testcases: [
            { input: "3\\n1 2 3", output: "6", score: 100, isSample: true, orderIndex: 1 },
          ],
        },
      ],
      solutions: [
        { title: "Official", content: "Explain the approach", type: "official", visibility: "public" },
      ],
    },
  ],
}

const quickLinks = [
  { href: "/admin/problems", label: "题库管理", icon: BookOpenText },
  { href: "/admin/problem-sets", label: "题单管理", icon: Puzzle },
  { href: "/admin/content", label: "内容后台", icon: LayoutPanelTop },
  { href: "/admin/discussions", label: "讨论审核", icon: MessageSquareWarning },
  { href: "/admin/data-kit", label: "造数据工具箱", icon: FlaskConical },
  { href: "/admin/organizations", label: "机构后台", icon: Database },
  { href: "/admin/classes", label: "班级后台", icon: GraduationCap },
  { href: "/admin/store-products", label: "商品管理", icon: Package },
  { href: "/admin/import-export", label: "导入导出", icon: Download },
]

export default function AdminToolsPage() {
  const showAdminDevTools = isAdminDevToolsVisible()
  const [endpoint, setEndpoint] = React.useState("/api/admin/problems/import")
  const [method, setMethod] = React.useState("POST")
  const [body, setBody] = React.useState(JSON.stringify(defaultPayload, null, 2))
  const [result, setResult] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const { data: opsResponse, isLoading: opsLoading } = useSWR<OpsOverviewResponse>(
    "/admin/analytics/ops/overview",
    () => api.admin.analytics.ops.overview<OpsOverviewResponse>(),
  )
  const { data: pendingPostsResponse, isLoading: postsLoading } = useSWR<ModerationListResponse>(
    ["/discussions/moderation/posts", "manual_review"],
    () =>
      api.discussions.moderation.posts.list<ModerationListResponse>({
        page: "1",
        pageSize: "5",
        auditStatus: "manual_review",
      }),
  )
  const { data: pendingCommentsResponse, isLoading: commentsLoading } = useSWR<ModerationListResponse>(
    ["/discussions/moderation/comments", "manual_review"],
    () =>
      api.discussions.moderation.comments.list<ModerationListResponse>({
        page: "1",
        pageSize: "5",
        auditStatus: "manual_review",
      }),
  )
  const { data: pendingReportsResponse, isLoading: reportsLoading } = useSWR<ModerationListResponse>(
    ["/discussions/moderation/reports", "pending"],
    () =>
      api.discussions.moderation.reports.list<ModerationListResponse>({
        page: "1",
        pageSize: "5",
        status: "pending",
      }),
  )

  const send = async () => {
    setLoading(true)
    setResult("")
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : body,
      })
      const text = await res.text()
      setResult(text)
    } catch (err) {
      setResult(String(err))
    } finally {
      setLoading(false)
    }
  }

  const ops = opsResponse?.data
  const pendingPosts = pendingPostsResponse?.data?.total ?? pendingPostsResponse?.data?.items?.length ?? 0
  const pendingComments =
    pendingCommentsResponse?.data?.total ?? pendingCommentsResponse?.data?.items?.length ?? 0
  const pendingReports =
    pendingReportsResponse?.data?.total ?? pendingReportsResponse?.data?.items?.length ?? 0
  const totalPending = pendingPosts + pendingComments + pendingReports
  const moderationQueueRows = [
    {
      id: "posts",
      label: "待审帖子",
      count: pendingPosts,
      note: "优先看比赛相关、题解延迟公开和结构化求助内容。",
      href: "/admin/discussions?tab=posts&auditStatus=manual_review",
    },
    {
      id: "comments",
      label: "待审评论",
      count: pendingComments,
      note: "重点拦截剧透、灌水和直接求 AC 代码的回复。",
      href: "/admin/discussions?tab=comments&auditStatus=manual_review",
    },
    {
      id: "reports",
      label: "待处理举报",
      count: pendingReports,
      note: "先处理高风险举报，再回查对应帖子或评论的公开状态。",
      href: "/admin/discussions?tab=reports&status=pending",
    },
  ]

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin Dashboard"
          title="把教学运营、质量监控和待处理队列收在同一个后台入口。"
          description="先给管理员看到今天最需要处理的内容：系统健康、讨论审核、内容运营与导入导出。开发自检工具保留，但明确放在下方，不和正式操作入口混在一起。"
          meta={
            <>
              <span>教学运营</span>
              <span>·</span>
              <span>质量监控</span>
              <span>·</span>
              <span>待办优先级</span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/discussions">进入审核队列</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/admin/analytics">查看学习分析</Link>
              </Button>
            </div>
          }
          aside={
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today Focus</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{totalPending} 个待处理事项</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">DB / Redis</p>
                  <div className="mt-2 flex gap-2">
                    <StatusBadge tone={ops?.health.db ? "success" : "danger"}>DB</StatusBadge>
                    <StatusBadge tone={ops?.health.redis ? "success" : "danger"}>Redis</StatusBadge>
                  </div>
                </div>
                <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">环境</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">开发联调中</p>
                </div>
              </div>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Queue"
            value={postsLoading || commentsLoading || reportsLoading ? "加载中" : totalPending}
            description="帖子、评论和举报待处理总量"
            icon={ShieldAlert}
            tone="primary"
          />
          <StatCard
            label="Alerts"
            value={pendingReports}
            description="举报工单待处理"
            icon={AlertTriangle}
            tone="warning"
          />
          <StatCard
            label="Requests"
            value={opsLoading ? "..." : Object.values(ops?.httpRequests ?? {}).reduce((sum, count) => sum + count, 0)}
            description="当前监控窗口内累计请求数"
            icon={Gauge}
            tone="secondary"
          />
          <StatCard
            label="Quality"
            value={pendingPosts + pendingComments}
            description="讨论内容待审核"
            icon={WandSparkles}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <SectionCard
              title="正式运营入口"
              description="题库、内容、讨论、商品和机构入口集中摆放，避免在后台里到处找页面。"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {quickLinks.map((item) => {
                  const Icon = item.icon
                  return (
                    <Button key={item.href} asChild variant="secondary" className="h-auto justify-between px-4 py-4">
                      <Link href={item.href}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-4" />
                          {item.label}
                        </span>
                        <Sparkles className="size-4" />
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard
              title="异常告警与质量面板"
              description="先看系统健康和审核堆积，再决定今天先处理教研内容、社区风控还是导入导出。"
            >
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <AlertPanel
                    title="系统健康"
                    description="只要 DB 和 Redis 任一异常，就不要继续批量导入或放量审核，先恢复基础服务。"
                    icon={Gauge}
                    tone={ops?.health.db && ops?.health.redis ? "success" : "warning"}
                    action={opsLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                  />
                  <AlertPanel
                    title="审核堆积提醒"
                    description={
                      totalPending > 0
                        ? `当前还有 ${totalPending} 个讨论相关待办，优先处理比赛相关、题解延迟公开和举报工单。`
                        : "当前讨论相关待办已清空，可以继续做题库、课程或导入导出操作。"
                    }
                    icon={MessageSquareWarning}
                    tone={totalPending > 0 ? "warning" : "success"}
                  />
                </div>
                <div className="surface-inset rounded-[1.5rem] p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <StatusBadge tone={ops?.health.db ? "success" : "danger"}>数据库 {ops?.health.db ? "正常" : "异常"}</StatusBadge>
                    <StatusBadge tone={ops?.health.redis ? "success" : "danger"}>Redis {ops?.health.redis ? "正常" : "异常"}</StatusBadge>
                  </div>
                  <QueueTable title="讨论队列" rows={moderationQueueRows} />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="今日待办" description="把运营后台从入口集合改成任务看板，管理员一进来就知道先做什么。">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="font-semibold text-foreground">1. 先清空讨论审核队列</p>
                  <p className="mt-2 leading-7">
                    比赛期和题解相关内容优先，避免剧透或延迟公开配置遗漏。
                  </p>
                </div>
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="font-semibold text-foreground">2. 检查导入与题库更新</p>
                  <p className="mt-2 leading-7">
                    新增题目、题单和内容包时，统一从正式入口进入，减少开发工具误用。
                  </p>
                </div>
                <div className="surface-inset rounded-[1.35rem] p-4">
                  <p className="font-semibold text-foreground">3. 关注学习分析和异常告警</p>
                  <p className="mt-2 leading-7">
                    如果系统正常但通过率异常下降，优先排查题目数据和判题配置。
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="开发与诊断工具" description="保留联调能力，但明确作为下层工具，不和日常运营操作混用。">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Endpoint</label>
                  <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Method</label>
                  <select
                    className="focus-ring ui-field h-11 px-3 text-sm"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PATCH</option>
                    <option>DELETE</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">JSON Body</label>
                  <textarea
                    className="focus-ring ui-field min-h-[220px] px-4 py-3 text-sm"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={send} disabled={loading}>
                    {loading ? "请求中..." : "发送请求"}
                  </Button>
                  {showAdminDevTools ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEndpoint("/api/admin/dev/self-test")
                          setMethod("GET")
                          setBody("")
                        }}
                      >
                        自测
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEndpoint("/api/admin/dev/seed")
                          setMethod("POST")
                          setBody("")
                        }}
                      >
                        生成 Mock 数据
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEndpoint("/api/admin/problems/export")
                      setMethod("GET")
                      setBody("")
                    }}
                  >
                    导出题库(JSON)
                  </Button>
                </div>
                <Card className="rounded-[1.5rem] border-[2px] border-border bg-background shadow-none">
                  <CardContent className="p-5">
                    <div className="mb-2 text-sm text-muted-foreground">Response</div>
                    <pre className="whitespace-pre-wrap break-all text-sm text-foreground">{result || "暂无"}</pre>
                  </CardContent>
                </Card>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
