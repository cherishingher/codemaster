"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  AlertTriangle,
  BookOpenText,
  Download,
  Gauge,
  GraduationCap,
  LayoutPanelTop,
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

const coreLinks = [
  { href: "/admin/problems", label: "题库管理", icon: BookOpenText },
  { href: "/admin/problem-sets", label: "题单管理", icon: Puzzle },
  { href: "/admin/discussions", label: "讨论审核", icon: MessageSquareWarning },
  { href: "/admin/import-export", label: "导入导出", icon: Download },
  { href: "/admin/analytics", label: "学习分析", icon: Gauge },
]

const secondaryLinks = [
  { href: "/admin/secondary#content", label: "内容运营", icon: LayoutPanelTop },
  { href: "/admin/secondary#teaching", label: "教学运营", icon: GraduationCap },
  { href: "/admin/secondary#tools", label: "商品与工具", icon: Package },
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
  const recommendations = [
    totalPending > 0
      ? `先处理 ${totalPending} 个讨论待办，尤其是举报和比赛相关内容。`
      : "讨论审核队列已清空，可以继续题库、题单和内容运营。",
    opsLoading
      ? "系统健康状态加载中，批量操作前先确认 DB 和 Redis 正常。"
      : ops?.health.db && ops?.health.redis
        ? "基础服务正常，可继续导入导出、批量改题和测试数据生成。"
        : "DB 或 Redis 异常，先暂停批量操作，优先恢复基础服务。",
    "低频的内容、机构和商品工具页统一从扩展后台进入，主后台只留高频流程。",
  ]

  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin Dashboard"
          title="把高频后台入口收成一个更短、更直接的工作台。"
          description="首页只保留题库、审核、导入导出和监控摘要。内容、机构、商品和调试能力都继续保留，但统一下沉到扩展后台或高级区。"
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
                <Link href="/admin/problems">进入题库</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/admin/discussions">进入审核队列</Link>
              </Button>
            </div>
          }
          aside={
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today Focus</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{totalPending} 个待处理事项</p>
              </div>
              <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">系统状态</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge tone={ops?.health.db ? "success" : "danger"}>DB</StatusBadge>
                  <StatusBadge tone={ops?.health.redis ? "success" : "danger"}>Redis</StatusBadge>
                  <StatusBadge tone="secondary">开发环境</StatusBadge>
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
              title="核心后台入口"
              description="只保留管理员日常高频会用到的题库、题单、审核、导入导出和分析入口。"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {coreLinks.map((item) => {
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
              <details className="mt-4 rounded-[1.35rem] border-[2px] border-border/70 bg-muted/10 p-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                  <span>更多后台入口</span>
                  <span className="text-xs font-normal text-muted-foreground">内容、教学和商品等低频功能</span>
                </summary>
                <div className="mt-4">
                  <Button asChild variant="secondary" className="w-full justify-between px-4 py-4 md:w-auto">
                    <Link href="/admin/secondary">
                      <span className="inline-flex items-center gap-2">
                        <Package className="size-4" />
                        打开扩展后台目录
                      </span>
                      <Sparkles className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {secondaryLinks.map((item) => {
                    const Icon = item.icon
                    return (
                      <Button key={item.href} asChild variant="ghost" className="h-auto justify-between px-4 py-4">
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
              </details>
            </SectionCard>

            <SectionCard
              title="系统与审核"
              description="首页只保留简明健康状态和讨论审核队列，不再堆静态说明。"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={ops?.health.db ? "success" : "danger"}>
                    数据库 {ops?.health.db ? "正常" : "异常"}
                  </StatusBadge>
                  <StatusBadge tone={ops?.health.redis ? "success" : "danger"}>
                    Redis {ops?.health.redis ? "正常" : "异常"}
                  </StatusBadge>
                  <StatusBadge tone={totalPending > 0 ? "warning" : "success"}>
                    审核队列 {totalPending > 0 ? `${totalPending} 待处理` : "已清空"}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/admin/discussions">进入审核队列</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/admin/analytics">查看监控分析</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/admin/import-export">进入导入导出</Link>
                  </Button>
                </div>
                <div className="surface-inset rounded-[1.5rem] p-4">
                  <QueueTable title="讨论队列" rows={moderationQueueRows} />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="当前建议" description="把首页右侧改成简短行动提示，不再放大段静态说明。">
              <div className="space-y-3">
                {recommendations.map((item, index) => (
                  <div key={item} className="surface-inset rounded-[1.35rem] p-4 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">{index + 1}. 当前动作</p>
                    <p className="mt-2 leading-7">{item}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {showAdminDevTools ? (
              <SectionCard title="开发与诊断工具" description="仅开发环境显示，默认折叠，避免和日常运营内容混排。">
                <details className="rounded-[1.35rem] border-[2px] border-border/70 bg-muted/10 p-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                    <span>展开请求调试器</span>
                    <span className="text-xs font-normal text-muted-foreground">联调、造数据、自测接口</span>
                  </summary>
                  <div className="mt-4 space-y-4">
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
                </details>
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
