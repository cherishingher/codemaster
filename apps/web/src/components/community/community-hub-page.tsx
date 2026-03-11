"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { Award, Flame, MessageSquare, PlusCircle, Trophy, Users } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  getCommunityLevelLabel,
  getCommunityPostKindLabel,
  type CommunityFeedResponse,
  type CommunityMutationResponse,
  type CommunityPointsResponse,
  type CommunityRewardsResponse,
  type StudyGroupListResponse,
} from "@/lib/community"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const POST_KIND_OPTIONS = [
  { value: "discussion", label: "讨论" },
  { value: "activity", label: "学习动态" },
  { value: "achievement", label: "成就分享" },
  { value: "question", label: "提问" },
] as const

export function CommunityHubPage() {
  const { user, loggedIn } = useAuth()
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [postForm, setPostForm] = React.useState({
    title: "",
    content: "",
    kind: "activity",
    groupId: "",
  })
  const [groupForm, setGroupForm] = React.useState({
    name: "",
    summary: "",
    topic: "",
    level: "mixed",
  })
  const [submittingPost, setSubmittingPost] = React.useState(false)
  const [submittingGroup, setSubmittingGroup] = React.useState(false)

  const { data: groupsData, mutate: mutateGroups } = useSWR<StudyGroupListResponse>("/community/groups", () =>
    api.community.groups.list<StudyGroupListResponse>(),
  )
  const { data: feedData, mutate: mutateFeed } = useSWR<CommunityFeedResponse>("/community/feed", () =>
    api.community.feed.list<CommunityFeedResponse>(),
  )
  const { data: pointsData, mutate: mutatePoints } = useSWR<CommunityPointsResponse>(
    loggedIn ? "/community/me/points" : null,
    () => api.community.points.me<CommunityPointsResponse>(),
  )
  const { data: rewardsData, mutate: mutateRewards } = useSWR<CommunityRewardsResponse>("/community/rewards", () =>
    api.community.points.rewards<CommunityRewardsResponse>(),
  )

  const groups = groupsData?.data ?? []
  const feed = feedData?.data ?? []
  const rewards = rewardsData?.data ?? []
  const balance = pointsData?.data.balance ?? 0

  const submitPost = React.useCallback(async () => {
    if (!loggedIn) {
      setErrorMessage("登录后才能发布动态或讨论")
      return
    }

    setSubmittingPost(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.community.feed.createPost<CommunityMutationResponse>({
        ...postForm,
        groupId: postForm.groupId || undefined,
      })
      setMessage("动态已发布")
      setPostForm({ title: "", content: "", kind: "activity", groupId: "" })
      await Promise.all([mutateFeed(), mutatePoints()])
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "发布失败")
    } finally {
      setSubmittingPost(false)
    }
  }, [loggedIn, mutateFeed, mutatePoints, postForm])

  const submitGroup = React.useCallback(async () => {
    if (!loggedIn) {
      setErrorMessage("登录后才能创建学习小组")
      return
    }

    setSubmittingGroup(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.community.groups.create<CommunityMutationResponse>(groupForm)
      setMessage("学习小组已创建")
      setGroupForm({ name: "", summary: "", topic: "", level: "mixed" })
      await Promise.all([mutateGroups(), mutatePoints()])
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "创建失败")
    } finally {
      setSubmittingGroup(false)
    }
  }, [groupForm, loggedIn, mutateGroups, mutatePoints])

  const joinGroup = React.useCallback(
    async (groupId: string) => {
      if (!loggedIn) {
        setErrorMessage("登录后才能加入学习小组")
        return
      }

      setErrorMessage("")
      try {
        await api.community.groups.join(groupId)
        setMessage("已加入学习小组")
        await Promise.all([mutateGroups(), mutatePoints()])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "加入失败")
      }
    },
    [loggedIn, mutateGroups, mutatePoints],
  )

  const redeemReward = React.useCallback(
    async (productId: string) => {
      if (!loggedIn) {
        setErrorMessage("登录后才能兑换奖励")
        return
      }

      setErrorMessage("")
      try {
        await api.community.points.redeem<CommunityMutationResponse>(productId)
        setMessage("积分兑换成功，权益已发放到你的账号")
        await Promise.all([mutatePoints(), mutateRewards()])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "兑换失败")
      }
    },
    [loggedIn, mutatePoints, mutateRewards],
  )

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Community</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">学习社区</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            这里承接学习小组、讨论区、学习动态和积分奖励。底层继续复用现有用户、题目、训练路径和商品权益体系，不新建一套独立账号或兑换系统。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">我的积分</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{balance}</div>
          </div>
          <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">学习小组</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{groups.length}</div>
          </div>
          <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">最新动态</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{feed.length}</div>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">发布学习动态</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <Input
                  placeholder="标题，例如：今天把图论最短路专题刷完了"
                  value={postForm.title}
                  onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                />
                <select
                  className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                  value={postForm.kind}
                  onChange={(event) => setPostForm((current) => ({ ...current, kind: event.target.value }))}
                >
                  {POST_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                value={postForm.groupId}
                onChange={(event) => setPostForm((current) => ({ ...current, groupId: event.target.value }))}
              >
                <option value="">发布到公开社区</option>
                {groups.filter((group) => group.joined).map((group) => (
                  <option key={group.id} value={group.id}>
                    发布到：{group.name}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-[140px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                placeholder="分享今天的学习进展、遇到的问题、通过的题目或想交流的技巧。"
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
              />
              <Button onClick={submitPost} disabled={submittingPost}>
                <PlusCircle className="size-4" />
                {submittingPost ? "发布中..." : "发布动态"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">社区动态</h2>
              </div>
              <div className="space-y-4">
                {feed.length === 0 ? (
                  <div className="rounded-[1.3rem] border-[2px] border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                    还没有公开动态，先来发布第一条学习分享。
                  </div>
                ) : (
                  feed.map((post) => (
                    <div key={post.id} className="rounded-[1.3rem] border-[2px] border-border bg-card px-5 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          {getCommunityPostKindLabel(post.kind)}
                        </Badge>
                        {post.group ? (
                          <Badge variant="secondary">
                            小组：{post.group.name}
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-foreground">{post.title}</h3>
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                        {post.content.length > 220 ? `${post.content.slice(0, 220)}...` : post.content}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <div>
                          {post.author.name || "匿名同学"} · {new Date(post.createdAt).toLocaleString("zh-CN")}
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{post.commentCount} 条评论</span>
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/discuss/posts/${post.id}`}>查看讨论</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">创建学习小组</h2>
              </div>
              <Input
                placeholder="小组名称"
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                placeholder="一句话简介"
                value={groupForm.summary}
                onChange={(event) => setGroupForm((current) => ({ ...current, summary: event.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="主题，如：动态规划 / 面试"
                  value={groupForm.topic}
                  onChange={(event) => setGroupForm((current) => ({ ...current, topic: event.target.value }))}
                />
                <select
                  className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                  value={groupForm.level}
                  onChange={(event) => setGroupForm((current) => ({ ...current, level: event.target.value }))}
                >
                  <option value="mixed">混合</option>
                  <option value="beginner">入门</option>
                  <option value="intermediate">进阶</option>
                  <option value="advanced">高级</option>
                </select>
              </div>
              <Button onClick={submitGroup} disabled={submittingGroup}>
                <Users className="size-4" />
                {submittingGroup ? "创建中..." : "创建小组"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">学习小组</h2>
              </div>
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-foreground">{group.name}</div>
                          <Badge variant="secondary">{getCommunityLevelLabel(group.level)}</Badge>
                        </div>
                        {group.summary ? <div className="mt-1 text-sm text-muted-foreground">{group.summary}</div> : null}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {group.memberCount} 人 · {group.postCount} 条讨论 {group.topic ? `· ${group.topic}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/discuss/groups/${group.slug}`}>查看</Link>
                        </Button>
                        {!group.joined ? (
                          <Button size="sm" onClick={() => joinGroup(group.id)}>
                            加入
                          </Button>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                            已加入
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">积分兑换</h2>
              </div>
              <div className="space-y-3">
                {rewards.length === 0 ? (
                  <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                    还没有配置可兑换商品。可在后台商品 `metadata.rewardPointsCost` 中配置积分价格。
                  </div>
                ) : (
                  rewards.map((reward) => (
                    <div key={reward.productId} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                      <div className="text-base font-semibold text-foreground">{reward.name}</div>
                      {reward.summary ? <div className="mt-1 text-sm text-muted-foreground">{reward.summary}</div> : null}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {reward.pointsCost} 积分 · 商品原价 {reward.defaultSkuPriceText}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => redeemReward(reward.productId)} disabled={!reward.redeemable}>
                          <Award className="size-4" />
                          {reward.redeemable ? "立即兑换" : "积分不足"}
                        </Button>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/products/${reward.productId}`}>查看商品</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">积分明细</h2>
              </div>
              {!loggedIn ? (
                <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  登录后可查看你的积分获取记录和最近兑换结果。
                </div>
              ) : pointsData?.data.recentTransactions.length ? (
                <div className="space-y-3">
                  {pointsData.data.recentTransactions.map((item) => (
                    <div key={item.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{item.note || item.actionType}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString("zh-CN")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-semibold ${
                              item.pointsDelta >= 0 ? "text-emerald-700" : "text-orange-700"
                            }`}
                          >
                            {item.pointsDelta >= 0 ? `+${item.pointsDelta}` : item.pointsDelta}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">余额 {item.balanceAfter}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  还没有积分记录。发动态、参与评论、创建或加入学习小组、首次通过题目后，这里会出现积分流水。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">最近兑换</h2>
              </div>
              {!loggedIn ? (
                <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  登录后可查看你的最近兑换记录。
                </div>
              ) : pointsData?.data.recentRedemptions.length ? (
                <div className="space-y-3">
                  {pointsData.data.recentRedemptions.map((item) => (
                    <div key={item.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                      <div className="text-sm font-semibold text-foreground">{item.productName}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{item.pointsCost} 积分</span>
                        <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                        <span>状态：{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
                  你还没有积分兑换记录。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
