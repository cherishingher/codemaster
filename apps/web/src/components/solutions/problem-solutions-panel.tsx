"use client"

import * as React from "react"
import useSWR from "swr"
import {
  BookOpenText,
  ChevronDown,
  ChevronUp,
  Crown,
  Lock,
  MonitorPlay,
  Sparkles,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type {
  ProblemSolutionSummaryItem,
  ProblemSolutionsResponse,
  SolutionDetailItem,
  SolutionDetailResponse,
} from "@/lib/solutions"
import { AccessLockCard } from "@/components/content-access/access-lock-card"
import { InlineLockHint } from "@/components/content-access/inline-lock-hint"
import { ProblemRichText } from "@/components/problems/problem-markdown"
import { SolutionVideoPlayer } from "@/components/solutions/solution-video-player"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

function getSolutionTypeLabel(type: string) {
  switch (type) {
    case "official":
      return "官方题解"
    case "ugc":
      return "社区题解"
    default:
      return type
  }
}

function getAccessLevelLabel(level: string | null, visibility: string) {
  const normalized = (level ?? visibility).trim().toUpperCase()

  switch (normalized) {
    case "FREE":
    case "PUBLIC":
      return "免费"
    case "MEMBERSHIP":
    case "VIP":
      return "VIP"
    case "PURCHASE":
      return "单独购买"
    case "MEMBERSHIP_OR_PURCHASE":
    case "MEMBER_OR_PURCHASE":
    case "PROTECTED":
      return "VIP 或购买"
    default:
      return visibility
  }
}

function SolutionDetailSections({
  solution,
}: {
  solution: SolutionDetailItem
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenText className="size-4 text-primary" />
          <h5 className="text-lg font-semibold text-foreground">题解摘要</h5>
        </div>
        {solution.summary ? (
          <ProblemRichText content={solution.summary} />
        ) : (
          <p className="text-sm text-muted-foreground">摘要待补充。</p>
        )}
      </div>

      {solution.videoUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MonitorPlay className="size-4 text-primary" />
            <h5 className="text-lg font-semibold text-foreground">视频解析</h5>
          </div>
          <SolutionVideoPlayer url={solution.videoUrl} title={solution.title} />
        </div>
      ) : null}

      {solution.content ? (
        <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h5 className="text-lg font-semibold text-foreground">完整题解</h5>
          </div>
          <ProblemRichText content={solution.content} />
        </div>
      ) : null}
    </div>
  )
}

function LockedSolutionSections({
  solution,
}: {
  solution: ProblemSolutionSummaryItem
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenText className="size-4 text-primary" />
          <h5 className="text-lg font-semibold text-foreground">题解摘要</h5>
        </div>
        {solution.summary ? (
          <ProblemRichText content={solution.summary} />
        ) : solution.previewContent ? (
          <p className="text-sm leading-7 text-muted-foreground">{solution.previewContent}</p>
        ) : (
          <p className="text-sm text-muted-foreground">当前题解暂无公开摘要。</p>
        )}
      </div>

      <InlineLockHint access={solution.access} label="完整题解与视频解析未解锁" />
    </div>
  )
}

export function ProblemSolutionsPanel({
  problemId,
}: {
  problemId: string
}) {
  const { data, error, isLoading } = useSWR<ProblemSolutionsResponse>(
    problemId ? `/problems/${problemId}/solutions` : null,
    () => api.problems.solutions<ProblemSolutionsResponse>(problemId),
  )

  const solutions = data?.data ?? []
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!expandedId && solutions.length > 0) {
      setExpandedId((solutions.find((item) => !item.locked) ?? solutions[0]).id)
    }
  }, [expandedId, solutions])

  const expandedSolution = solutions.find((item) => item.id === expandedId) ?? null

  const {
    data: detailResponse,
    error: detailError,
    isLoading: detailLoading,
  } = useSWR<SolutionDetailResponse>(
    expandedSolution ? `/solutions/${expandedSolution.id}` : null,
    () => api.solutions.get<SolutionDetailResponse>(expandedSolution!.id),
  )

  const detail = detailResponse?.data ?? null

  if (isLoading) {
    return (
      <Card className="bg-background">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          高级题解加载中...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background">
        <CardContent className="space-y-3 p-5 text-sm text-red-700">
          题解加载失败，请稍后重试。
        </CardContent>
      </Card>
    )
  }

  if (solutions.length === 0) {
    return (
      <Card className="bg-background">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-12 items-center justify-center rounded-[1rem] border-[2px] border-border bg-card">
              <BookOpenText className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">高级题解与视频解析</h3>
              <p className="text-sm text-muted-foreground">当前题目还没有录入题解内容。</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const lockedCount = solutions.filter((item) => item.locked).length
  const hasVideo = solutions.some((item) => item.hasVideo)
  const primaryLocked = solutions.find((item) => item.locked) ?? null

  return (
    <div className="space-y-4">
      <Card className="bg-background">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                Premium Solution Layer
              </div>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">高级题解与视频解析</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  继续复用现有 `Solution` 模型。免费用户只读摘要，已解锁用户再通过题解详情接口拿完整正文与视频解析。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{solutions.length} 条题解</Badge>
              {hasVideo ? <Badge variant="secondary">含视频解析</Badge> : null}
              {lockedCount > 0 ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {lockedCount} 条待解锁
                </Badge>
              ) : null}
            </div>
          </div>

          {primaryLocked ? (
            <AccessLockCard
              access={primaryLocked.access}
              title="高级题解由统一权限中心托管"
              description="免费用户默认只能看到摘要。VIP 会员或已购买对应内容包的用户，才会通过详情接口拿到完整题解与视频解析。"
              compact
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {solutions.map((solution) => {
          const expanded = expandedId === solution.id
          const isCurrent = detail?.id === solution.id

          return (
            <Card key={solution.id} className="bg-background">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{getSolutionTypeLabel(solution.type)}</Badge>
                      <Badge variant="secondary">
                        {getAccessLevelLabel(solution.accessLevel, solution.visibility)}
                      </Badge>
                      {solution.isPremium ? (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          <Crown className="mr-1 size-3.5" />
                          高级内容
                        </Badge>
                      ) : null}
                      {solution.hasVideo ? (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          <MonitorPlay className="mr-1 size-3.5" />
                          视频解析
                        </Badge>
                      ) : null}
                      {solution.locked ? (
                        <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-700">
                          <Lock className="mr-1 size-3.5" />
                          未解锁
                        </Badge>
                      ) : null}
                    </div>

                    <div>
                      <h4 className="text-xl font-semibold text-foreground">{solution.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {solution.author.name ?? "匿名作者"} · {new Date(solution.createdAt).toLocaleDateString("zh-CN")}
                        {solution.version ? ` · V${solution.version.version}` : ""}
                      </p>
                    </div>

                    {solution.summary ? (
                      <p className="max-w-4xl text-sm leading-7 text-muted-foreground">{solution.summary}</p>
                    ) : solution.previewContent ? (
                      <p className="max-w-4xl text-sm leading-7 text-muted-foreground">
                        {solution.previewContent}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setExpandedId(expanded ? null : solution.id)}
                  >
                    {expanded ? "收起" : "查看详情"}
                    {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>

                {expanded ? (
                  detailLoading && !isCurrent ? (
                    <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                      正在加载题解详情...
                    </div>
                  ) : detailError && !isCurrent ? (
                    <div className="rounded-[1.4rem] border-[2px] border-red-400/40 bg-red-500/10 px-4 py-4 text-sm text-red-700">
                      题解详情加载失败，请稍后重试。
                    </div>
                  ) : isCurrent && detail ? (
                    detail.locked ? (
                      <LockedSolutionSections solution={detail} />
                    ) : (
                      <SolutionDetailSections solution={detail} />
                    )
                  ) : solution.locked ? (
                    <LockedSolutionSections solution={solution} />
                  ) : null
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
