import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  Flame,
  GraduationCap,
  LayoutList,
  Lock,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { db } from "@/lib/db"
import { HOME_TRACKS } from "@/lib/home-tracks"
import { HOME_FEATURES } from "@/lib/home-features"
import { getSubmissionStatusClass, getSubmissionStatusLabel } from "@/lib/submissions"
import { getFeaturedLearnCourses, getLearnViewerFromCookies, getVideoMembershipProduct } from "@/lib/learn"
import { AlertPanel } from "@/components/patterns/alert-panel"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { StatCard } from "@/components/patterns/stat-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { UpgradePlanButton } from "@/components/learn/upgrade-plan-button"
import { Button } from "@/components/ui/button"

const problemScaleStats = [
  { value: "1000+", label: "已入库题目", icon: BookOpen, tone: "primary" as const },
  { value: "30万+", label: "累计提交", icon: TrendingUp, tone: "secondary" as const },
  { value: "500+", label: "图形化任务", icon: Sparkles, tone: "accent" as const },
]

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
  }).format(priceCents / 100)
}

function formatDateTime(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleString("zh-CN") : "-"
}

function getWeeklyWindowStart() {
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return start
}

function buildHomeSuggestions(input: {
  isLoggedIn: boolean
  recentSubmissionCount: number
  recentAcceptedCount: number
  featuredCourseCount: number
  isPaid: boolean
}) {
  const suggestions = []

  if (!input.isLoggedIn) {
    suggestions.push({
      title: "先登录并保存训练记录",
      description: "登录后才能把最近提交、学习进度和讨论互动完整串成训练闭环。",
      href: "/login",
      label: "前往登录",
    })
  } else if (input.recentSubmissionCount === 0) {
    suggestions.push({
      title: "今天先做 1 道题启动训练",
      description: "先用一道基础题把训练链路打通，再回看提交反馈和训练看板。",
      href: "/problems",
      label: "去题库做题",
    })
  } else {
    suggestions.push({
      title: `最近 7 天已提交 ${input.recentSubmissionCount} 次`,
      description: input.recentAcceptedCount > 0
        ? `其中 ${input.recentAcceptedCount} 次通过，可以继续向更高难度推进。`
        : "目前还没有通过记录，建议优先复盘最近一次失败提交的边界和复杂度。",
      href: "/submissions",
      label: "查看提交记录",
    })
  }

  if (input.featuredCourseCount > 0) {
    suggestions.push({
      title: input.isPaid ? "补一节课程强化概念" : "先看一节试看课再开始训练",
      description: input.isPaid
        ? "把课程学习和做题训练配在同一天，效果会比只刷题更稳。"
        : "如果今天不想直接刷题，先通过课程建立题型直觉，再回题库训练。",
      href: "/learn",
      label: "进入学习中心",
    })
  }

  suggestions.push({
    title: "给自己留一个可执行的下一步",
    description: "不要让首页只是入口页。今天最好只选一件最明确的事情：刷题、补课或复盘。",
    href: "/dashboard",
    label: "查看训练看板",
  })

  return suggestions.slice(0, 3)
}

export default async function Home() {
  const [featuredLearnCourses, viewer, product] = await Promise.all([
    getFeaturedLearnCourses(3),
    getLearnViewerFromCookies(),
    getVideoMembershipProduct(),
  ])

  const weeklyWindowStart = getWeeklyWindowStart()

  const [recentSubmissions, recentSubmissionCount, recentAcceptedCount] = viewer.userId
    ? await Promise.all([
        db.submission.findMany({
          where: { userId: viewer.userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            problem: {
              select: {
                slug: true,
                title: true,
              },
            },
          },
        }),
        db.submission.count({
          where: {
            userId: viewer.userId,
            createdAt: { gte: weeklyWindowStart },
          },
        }),
        db.submission.count({
          where: {
            userId: viewer.userId,
            createdAt: { gte: weeklyWindowStart },
            status: { in: ["ACCEPTED", "AC"] },
          },
        }),
      ])
    : [[], 0, 0]

  const acceptedRate = recentSubmissionCount > 0 ? Math.round((recentAcceptedCount / recentSubmissionCount) * 100) : 0
  const suggestions = buildHomeSuggestions({
    isLoggedIn: viewer.isLoggedIn,
    recentSubmissionCount,
    recentAcceptedCount,
    featuredCourseCount: featuredLearnCourses.length,
    isPaid: viewer.plan === "paid",
  })

  return (
    <div className="pb-20">
      <section className="page-wrap py-10 md:py-14 lg:py-16">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Today Goal"
            title={viewer.isLoggedIn ? `${viewer.name ?? "同学"}，今天先把训练闭环跑起来。` : "今天先选一件明确的事：刷题、补课，或者复盘最近提交。"}
            description="首页现在不再做成普通宣传页，而是一个真正的训练入口。你一进来就能看到推荐题单、最近提交、学习建议和下一步操作。"
            meta={
              <>
                <span>推荐题单</span>
                <span>·</span>
                <span>最近提交</span>
                <span>·</span>
                <span>学习建议</span>
                <span>·</span>
                <span>训练看板</span>
              </>
            }
            actions={
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="min-w-[15rem] justify-center">
                  <Link href="/problems">
                    立即开始刷题
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="min-w-[14rem] justify-center">
                  <Link href="/dashboard">查看训练看板</Link>
                </Button>
              </div>
            }
            aside={
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today Checklist</p>
                  <div className="space-y-2">
                    <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">1. 选一道题开始训练</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">从题库或专题题单进入，今天先完成第一轮提交。</p>
                    </div>
                    <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">2. 看结果，不只看状态</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">提交后继续看测试点、耗时和改进建议，而不是只看 AC / WA。</p>
                    </div>
                    <div className="rounded-[1.25rem] border-[3px] border-border bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">3. 留下下一步</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">做完题后决定是继续刷题、补一节课，还是发讨论求助。</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近 7 天</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{recentSubmissionCount}</p>
                    <p className="text-sm text-muted-foreground">提交次数</p>
                  </div>
                  <div className="rounded-[1.3rem] border-[3px] border-border bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">通过率</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{acceptedRate}%</p>
                    <p className="text-sm text-muted-foreground">最近窗口内</p>
                  </div>
                </div>
              </div>
            }
          />

          <div className="grid gap-4 md:grid-cols-3">
            {problemScaleStats.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                description="首页总览指标"
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="page-wrap py-10 md:py-12">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <SectionCard
            title="推荐题单"
            description="把最常用的训练入口前置到首页，不让用户先在导航和列表里迷路。"
            action={
              <Button asChild variant="secondary">
                <Link href="/tracks">
                  查看全部题单
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          >
            <div className="grid gap-4">
              {HOME_TRACKS.slice(0, 3).map((track) => {
                const Icon = track.icon
                return (
                  <Link
                    key={track.slug}
                    href={track.primaryHref}
                    className="surface-inset block rounded-[1.7rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_hsl(var(--border))]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`flex size-16 items-center justify-center rounded-[1.4rem] border-[3px] border-border ${track.tone}`}>
                          <Icon className="size-7 text-foreground" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{track.title}</h3>
                            <StatusBadge tone="info">{track.rating} 分推荐</StatusBadge>
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">{track.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <BookOpen className="size-4 text-primary" />
                              {track.lessons}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="size-4 text-primary" />
                              {track.duration}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Flame className="size-4 text-primary" />
                              {track.learners}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href={track.primaryHref}>开始训练</Link>
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={track.secondaryHref}>查看相关页面</Link>
                        </Button>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="最近提交"
            description="提交页不该是孤立页面。首页直接把最近结果露出来，方便继续复盘。"
            action={
              viewer.isLoggedIn ? (
                <Button asChild variant="secondary">
                  <Link href="/submissions">
                    查看全部提交
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null
            }
          >
            {viewer.isLoggedIn ? (
              recentSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {recentSubmissions.map((submission) => (
                    <Link
                      key={submission.id}
                      href={`/submissions/${submission.id}`}
                      className="surface-inset block rounded-[1.5rem] p-4 transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_hsl(var(--border))]"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-base font-semibold text-foreground">{submission.problem.title}</p>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getSubmissionStatusClass(submission.status)}`}>
                            {getSubmissionStatusLabel(submission.status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{submission.lang}</span>
                          <span>·</span>
                          <span>{formatDateTime(submission.createdAt)}</span>
                          <span>·</span>
                          <span>得分 {submission.score}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.6rem] border-[3px] border-dashed border-border bg-background px-5 py-6 text-sm leading-7 text-muted-foreground">
                  当前账号还没有提交记录。先从题库做一道题，首页就会开始显示你的最近结果和训练节奏。
                </div>
              )
            ) : (
              <div className="space-y-4 rounded-[1.6rem] border-[3px] border-dashed border-border bg-background px-5 py-6">
                <p className="text-sm leading-7 text-muted-foreground">
                  登录后首页会直接显示最近提交、最近通过题和训练建议，方便你从上一次停下来的地方继续。
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/login">登录后继续训练</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/register">注册账号</Link>
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </section>

      <section className="page-wrap py-10 md:py-12">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SectionCard
            title="学习建议"
            description="首页不只推荐入口，还要告诉用户下一步最值得做什么。"
            action={<Compass className="size-4 text-primary" />}
          >
            <div className="grid gap-4">
              {suggestions.map((item) => (
                <div key={item.title} className="surface-inset rounded-[1.5rem] p-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-[1rem] border-[2px] border-border bg-white p-2">
                        <BrainCircuit className="size-4 text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={item.href}>
                          {item.label}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="课程推荐"
            description="把试看课和会员课前置，帮助用户在刷题之外快速补齐概念。"
            action={
              <div className="flex items-center gap-2">
                <StatusBadge tone={viewer.plan === "paid" ? "success" : "warning"}>
                  {viewer.plan === "paid" ? "VIP 会员" : viewer.isLoggedIn ? "免费版" : "访客模式"}
                </StatusBadge>
                <UpgradePlanButton plan={viewer.plan} />
              </div>
            }
          >
            <div className="grid gap-4">
              {featuredLearnCourses.length > 0 ? (
                featuredLearnCourses.map((course) => (
                  <div key={course.id} className="surface-inset rounded-[1.55rem] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="info">{course.category || "课程"}</StatusBadge>
                          <StatusBadge tone="muted">试看 {course.previewCount} 节</StatusBadge>
                        </div>
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground">{course.title}</h3>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {course.summary || course.description || "课程简介待补充"}
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <PlayCircle className="size-4 text-primary" />
                            {course.lessonCount} 节
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Lock className="size-4 text-primary" />
                            会员 {course.paidLessonCount} 节
                          </span>
                        </div>
                      </div>
                      <Button asChild variant="secondary">
                        <Link href={`/learn/${course.slug}`}>
                          进入课程
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.6rem] border-[3px] border-dashed border-border bg-background px-5 py-6 text-sm leading-7 text-muted-foreground">
                  当前数据库里还没有已发布课程。学习中心结构已经就绪，后续上课后这里会自动出现推荐课程。
                </div>
              )}
              <div className="rounded-[1.6rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(103,197,89,0.14),rgba(245,184,167,0.16))] px-5 py-5">
                <p className="text-sm font-semibold text-foreground">{product.name}</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-semibold text-foreground">{formatPrice(product.priceCents)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.validDays ? `有效期 ${product.validDays} 天` : "长期有效"} · 学习中心与视频权限统一管理
                    </p>
                  </div>
                  <UpgradePlanButton plan={viewer.plan} size="lg" />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="page-wrap py-10 md:py-12">
        <SectionCard
          title="平台能力模块"
          description="不把首页做成纯营销页，而是把真正影响训练效率的能力模块收在一起。"
          action={
            <Button asChild variant="secondary">
              <Link href="/features">
                查看全部能力
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {HOME_FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.slug}
                  href={feature.primaryHref}
                  className="surface-inset rounded-[1.6rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_hsl(var(--border))]"
                >
                  <div className={`mb-4 flex size-14 items-center justify-center rounded-[1.25rem] border-[3px] border-border ${feature.tone}`}>
                    <Icon className="size-6 text-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                  <div className="mt-4 space-y-2">
                    {feature.highlights.slice(0, 2).map((item) => (
                      <p key={item} className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </SectionCard>
      </section>

      <section className="bg-secondary/70 py-16 md:py-20">
        <div className="page-wrap">
          <SectionCard
            title="不要让首页只是“看看再说”"
            description="现在它应该直接把你送进训练流程。今天最好的起点只有三个：去题库、看最近提交，或者补一节课。"
            action={
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="min-w-[16rem] justify-center">
                  <Link href="/problems">
                    去题库开始
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="min-w-[13rem] justify-center">
                  <Link href={viewer.isLoggedIn ? "/submissions" : "/login"}>
                    {viewer.isLoggedIn ? "看最近提交" : "登录后继续"}
                  </Link>
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <AlertPanel
                title="训练链路已打通"
                description="题库、提交、课程与训练看板已经在同一站内衔接，不需要再跳到割裂页面。"
                icon={CheckCircle2}
                tone="success"
              />
              <AlertPanel
                title="适合学生与老师"
                description="既可以做个人训练入口，也可以承接老师组织教学、题单和课程使用。"
                icon={GraduationCap}
                tone="info"
              />
              <AlertPanel
                title="首页直接给下一步"
                description="不再只是导航集合，而是先把今天最值得做的动作放到第一屏。"
                icon={LayoutList}
                tone="warning"
              />
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  )
}
