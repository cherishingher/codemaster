"use client"

import Link from "next/link"
import useSWR from "swr"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  ChartColumn,
  FileText,
  Medal,
  PlayCircle,
  Trophy,
  Users,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { formatContentAccessRequirement } from "@/lib/content-access"
import type {
  ContestAnalysisResponse,
  ContestDetailResponse,
  ContestReportResponse,
} from "@/lib/contests"
import {
  formatContestDateRange,
  getContestRegistrationStatusLabel,
} from "@/lib/contests"
import { formatPriceCents } from "@/lib/products"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { RecommendedProductsList } from "@/components/content-access/recommended-products-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function getContestPhase(startAt: string, endAt: string) {
  const now = Date.now()
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()

  if (now < start) return "即将开始"
  if (now > end) return "已结束"
  return "进行中"
}

export function ContestDetailPage() {
  const params = useParams()
  const rawId = params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const { data, error, isLoading } = useSWR<ContestDetailResponse>(
    id ? `/contests/${id}` : null,
    () => api.contests.get<ContestDetailResponse>(id as string),
  )

  const contest = data?.data
  const phase = contest ? getContestPhase(contest.startAt, contest.endAt) : null
  const isEnded = phase === "已结束"

  const { data: analysisData } = useSWR<ContestAnalysisResponse>(
    contest && isEnded ? `/contests/${contest.id}/analysis` : null,
    () => api.contests.analysis<ContestAnalysisResponse>(contest!.id),
  )

  const { data: reportData } = useSWR<ContestReportResponse>(
    contest && isEnded ? `/contests/${contest.id}/report` : null,
    () => api.contests.report<ContestReportResponse>(contest!.id),
  )

  if (error) {
    return (
      <div className="page-wrap py-10">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          模拟赛不存在或尚未开放。
        </div>
      </div>
    )
  }

  if (isLoading || !contest) {
    return (
      <div className="page-wrap py-10">
        <div className="text-sm text-muted-foreground">模拟赛详情加载中...</div>
      </div>
    )
  }

  const checkoutHref =
    contest.offer
      ? `/checkout?productId=${encodeURIComponent(contest.offer.productId)}&skuId=${encodeURIComponent(contest.offer.skuId)}`
      : null

  const analysis = analysisData?.data
  const report = reportData?.data

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href="/contests">
            <ArrowLeft className="size-4" />
            返回模拟赛列表
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  模拟赛
                </Badge>
                <Badge variant="secondary">{contest.rule}</Badge>
                <Badge variant="outline">{phase}</Badge>
                <Badge variant="outline">{formatContentAccessRequirement(contest.access.policy.requiredSources)}</Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">{contest.name}</h1>
                <p className="text-base leading-8 text-muted-foreground">
                  {contest.description || contest.summary || "当前模拟赛暂无更多描述。"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">比赛时间</p>
                <p className="mt-2 text-sm font-semibold leading-7 text-foreground">
                  {formatContestDateRange(contest.startAt, contest.endAt)}
                </p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">题目数量</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{contest.problemCount}</p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">报名情况</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {typeof contest.registrationLimit === "number"
                    ? `${contest.registrationCount}/${contest.registrationLimit}`
                    : contest.registrationCount}
                </p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">赛后能力</p>
                <p className="mt-2 text-sm font-semibold leading-7 text-foreground">
                  解析 {contest.analysisAccess.allowed ? "已解锁" : "可售卖"} / 报告 {contest.reportAccess.allowed ? "已解锁" : "可售卖"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={`/discuss?contestId=${encodeURIComponent(contest.id)}&postType=contest_discussion`}>
                  <Users className="size-4" />
                  比赛讨论
                </Link>
              </Button>
              {isEnded ? (
                <>
                  <Button asChild variant="secondary">
                    <Link href="#contest-analysis">
                      <PlayCircle className="size-4" />
                      查看赛后解析
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="#contest-report">
                      <FileText className="size-4" />
                      查看赛后报告
                    </Link>
                  </Button>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-5 p-7">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">报名与访问</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                购买报名券后会自动获得参赛资格；如果比赛提供赛后解析或报告，购买对应通行证后也会自动开放查看权限。
              </p>
            </div>

            {contest.registration ? (
              <div className="rounded-[1.3rem] border-[3px] border-primary/30 bg-primary/10 px-5 py-5">
                <p className="text-sm text-muted-foreground">我的报名状态</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {getContestRegistrationStatusLabel(contest.registration.status)}
                </p>
                {contest.registration.groupLabel ? (
                  <p className="mt-2 text-xs text-muted-foreground">分组：{contest.registration.groupLabel}</p>
                ) : null}
              </div>
            ) : null}

            {contest.result ? (
              <div className="rounded-[1.3rem] border-[3px] border-primary/30 bg-primary/10 px-5 py-5">
                <p className="text-sm text-muted-foreground">我的成绩</p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{contest.result.rank ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">总榜排名</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{contest.result.groupRank ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">分组排名</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{contest.result.solvedCount}</p>
                    <p className="text-xs text-muted-foreground">通过题数</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.3rem] border-[3px] border-border bg-card px-5 py-5">
              {contest.offer ? (
                <>
                  <p className="text-sm text-muted-foreground">报名价格</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {formatPriceCents(contest.offer.priceCents, contest.offer.currency)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{contest.offer.skuName}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">当前还没有绑定模拟赛商品。</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {checkoutHref ? (
                <Button asChild disabled={!contest.isRegistrationOpen}>
                  <Link href={checkoutHref}>
                    {contest.isRegistrationOpen ? "立即报名" : "报名已关闭"}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <div className="inline-flex items-center rounded-full border-[2px] border-dashed border-border/60 px-4 py-2 text-sm text-muted-foreground">
                  报名商品暂未开放
                </div>
              )}
              <Button asChild variant="secondary">
                <Link href="/products?type=contest">查看模拟赛商品</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {!contest.access.allowed ? (
        <section className="mt-10 space-y-6">
          <AccessLockCard
            access={contest.access}
            title="当前模拟赛尚未解锁"
            description="未解锁时后端只返回比赛简介、时间和预览题目，不返回完整题单、成绩和完整排行榜。"
          />
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Medal className="size-5 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">题目预览</h2>
              </div>
              <div className="grid gap-3">
                {contest.previewProblems.map((problem) => (
                  <div key={problem.id} className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-3">
                    <p className="font-medium text-foreground">#{problem.order} · {problem.title}</p>
                    <p className="text-xs text-muted-foreground">难度 {problem.difficulty}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <RecommendedProductsList
            products={contest.access.recommendedProducts}
            loggedIn={contest.access.userSummary.isLoggedIn}
          />
        </section>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <CalendarRange className="size-5 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">比赛题目</h2>
              </div>
              <div className="space-y-3">
                {contest.problems.map((problem) => (
                  <div key={problem.id} className="flex items-center justify-between rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">#{problem.order} · {problem.title}</p>
                      <p className="text-xs text-muted-foreground">难度 {problem.difficulty}</p>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/problems/${problem.slug}`}>
                        去做题
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">成绩与排行榜</h2>
              </div>
              <div className="space-y-3">
                {contest.rankings.length ? (
                  contest.rankings.map((item) => (
                    <div key={item.userId} className="flex items-center justify-between rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex size-10 items-center justify-center rounded-full border-[2px] border-border bg-background font-semibold text-foreground">
                          {item.rank}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            通过 {item.solvedCount} · 提交 {item.submissionCount}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        罚时 {item.penaltyMinutes} 分钟
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                    当前还没有形成排行榜。
                  </div>
                )}
              </div>
              <div className="rounded-[1.1rem] border-[2px] border-border bg-secondary/35 px-4 py-4 text-sm text-muted-foreground">
                这版是轻量模拟赛，不做正式比赛系统的封榜、申诉、组队与实时排名细节。
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isEnded ? (
        <div className="mt-10 space-y-6">
          <section id="contest-analysis" className="space-y-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="size-5 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">赛后解析</h2>
            </div>

            {analysis && !analysis.access.allowed ? (
              <>
                <AccessLockCard
                  access={analysis.access}
                  title="赛后解析尚未解锁"
                  description="未解锁时后端只返回解析摘要，不返回完整题解正文和视频地址。"
                />
                <Card className="bg-background">
                  <CardContent className="space-y-3 p-6">
                    {analysis.previewItems.map((item) => (
                      <div key={item.problemId} className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="font-medium text-foreground">
                          #{item.order} · {item.problemTitle}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          {item.summary || "当前题目还没有录入赛后解析摘要。"}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <RecommendedProductsList
                  products={analysis.access.recommendedProducts}
                  loggedIn={analysis.access.userSummary.isLoggedIn}
                />
              </>
            ) : (
              <Card className="bg-background">
                <CardContent className="space-y-3 p-6">
                  {analysis?.items.length ? (
                    analysis.items.map((item) => (
                      <div key={item.problemId} className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">
                              #{item.order} · {item.problemTitle}
                            </p>
                            <p className="text-xs text-muted-foreground">难度 {item.difficulty}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`/problems/${item.problemSlug}`}>题目详情</Link>
                            </Button>
                            {item.solutionId ? (
                              <Button asChild size="sm">
                                <Link href={`/problems/${item.problemSlug}`}>
                                  查看题解
                                  <ArrowRight className="size-4" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {item.summary || "当前题目还没有录入赛后解析摘要。"}
                        </p>
                        {item.videoUrl ? (
                          <p className="mt-2 text-xs text-primary">已接入视频解析</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                      当前还没有录入赛后解析。
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>

          <section id="contest-report" className="space-y-4">
            <div className="flex items-center gap-2">
              <ChartColumn className="size-5 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">赛后报告</h2>
            </div>

            {report && !report.access.allowed ? (
              <>
                <AccessLockCard
                  access={report.access}
                  title="赛后报告尚未解锁"
                  description="未解锁时只返回基础说明，不返回个人成绩细节、分组榜单和针对性建议。"
                />
                <Card className="bg-background">
                  <CardContent className="p-6 text-sm leading-7 text-muted-foreground">
                    {report.summary}
                  </CardContent>
                </Card>
                <RecommendedProductsList
                  products={report.access.recommendedProducts}
                  loggedIn={report.access.userSummary.isLoggedIn}
                />
              </>
            ) : (
              <Card className="bg-background">
                <CardContent className="space-y-6 p-6">
                  <div className="rounded-[1.1rem] border-[2px] border-primary/25 bg-primary/10 px-5 py-5">
                    <p className="text-sm text-muted-foreground">报告摘要</p>
                    <p className="mt-2 text-sm leading-7 text-foreground">{report?.summary || "当前还没有生成赛后报告。"}</p>
                  </div>

                  {report?.result ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-xs text-muted-foreground">总榜排名</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{report.result.rank ?? "-"}</p>
                      </div>
                      <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-xs text-muted-foreground">分组排名</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{report.result.groupRank ?? "-"}</p>
                      </div>
                      <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-xs text-muted-foreground">通过题数</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{report.result.solvedCount}</p>
                      </div>
                      <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <p className="text-xs text-muted-foreground">提交次数</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{report.result.submissionCount}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">分组排名报告</h3>
                      {report?.groupRankings.length ? (
                        report.groupRankings.map((group) => (
                          <div key={group.groupKey} className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                            <p className="font-medium text-foreground">{group.groupLabel}</p>
                            <div className="mt-3 space-y-2">
                              {group.items.slice(0, 5).map((item) => (
                                <div key={`${group.groupKey}:${item.userId}`} className="flex items-center justify-between text-sm">
                                  <span className="text-foreground">
                                    #{item.rank} {item.userName}
                                  </span>
                                  <span className="text-muted-foreground">通过 {item.solvedCount}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                          当前还没有分组榜单数据。
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">标签分布与建议</h3>
                      <div className="rounded-[1.1rem] border-[2px] border-border bg-card px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {report?.tagDistribution.length ? (
                            report.tagDistribution.map((item) => (
                              <Badge key={item.tag} variant="secondary">
                                {item.tag} · {item.count}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">当前还没有足够的标签统计。</span>
                          )}
                        </div>
                        <div className="mt-4 space-y-2">
                          {(report?.nextStepAdvice || []).map((item) => (
                            <div key={item} className="rounded-[1rem] border border-border/70 bg-secondary/35 px-3 py-3 text-sm text-muted-foreground">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
