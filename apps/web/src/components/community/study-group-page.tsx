"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, MessageSquare, PlusCircle, Users } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  getCommunityLevelLabel,
  getCommunityPostKindLabel,
  type CommunityFeedResponse,
  type CommunityMutationResponse,
  type StudyGroupDetailResponse,
} from "@/lib/community"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type StudyGroupPageProps = {
  groupIdOrSlug: string
}

const POST_KIND_OPTIONS = [
  { value: "discussion", label: "讨论" },
  { value: "activity", label: "学习动态" },
  { value: "achievement", label: "成就分享" },
  { value: "question", label: "提问" },
] as const

export function StudyGroupPage({ groupIdOrSlug }: StudyGroupPageProps) {
  const { loggedIn } = useAuth()
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [submittingPost, setSubmittingPost] = React.useState(false)
  const [joining, setJoining] = React.useState(false)
  const [postForm, setPostForm] = React.useState({
    title: "",
    content: "",
    kind: "discussion",
  })

  const { data: groupData, mutate: mutateGroup } = useSWR<StudyGroupDetailResponse>(
    `/community/groups/${groupIdOrSlug}`,
    () => api.community.groups.get<StudyGroupDetailResponse>(groupIdOrSlug),
  )

  const group = groupData?.data

  const { data: feedData, mutate: mutateFeed } = useSWR<CommunityFeedResponse>(
    group ? `/community/feed?groupId=${group.id}` : null,
    () =>
      api.community.feed.list<CommunityFeedResponse>({
        groupId: group!.id,
      }),
  )

  const feed = feedData?.data ?? []

  const joinGroup = React.useCallback(async () => {
    if (!group) return
    if (!loggedIn) {
      setErrorMessage("登录后才能加入学习小组")
      return
    }

    setJoining(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.community.groups.join<CommunityMutationResponse>(group.id)
      setMessage("已加入学习小组")
      await mutateGroup()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "加入失败")
    } finally {
      setJoining(false)
    }
  }, [group, loggedIn, mutateGroup])

  const submitPost = React.useCallback(async () => {
    if (!group) return
    if (!loggedIn) {
      setErrorMessage("登录后才能发帖")
      return
    }

    setSubmittingPost(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.community.feed.createPost<CommunityMutationResponse>({
        title: postForm.title,
        content: postForm.content,
        kind: postForm.kind,
        groupId: group.id,
      })
      setMessage("小组讨论已发布")
      setPostForm({ title: "", content: "", kind: "discussion" })
      await mutateFeed()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "发布失败")
    } finally {
      setSubmittingPost(false)
    }
  }, [group, loggedIn, mutateFeed, postForm.content, postForm.kind, postForm.title])

  if (!groupData) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          正在加载学习小组...
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          学习小组不存在或暂时不可访问。
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/discuss/legacy">
            <ArrowLeft className="size-4" />
            返回社区
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  学习小组
                </Badge>
                <Badge variant="secondary">{getCommunityLevelLabel(group.level)}</Badge>
                {group.topic ? <Badge variant="secondary">{group.topic}</Badge> : null}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{group.name}</h1>
                {group.summary ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{group.summary}</p> : null}
                {group.description ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{group.description}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">成员数</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{group.memberCount}</div>
                </div>
                <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">讨论数</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{group.postCount}</div>
                </div>
                <div className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">创建者</div>
                  <div className="mt-2 text-base font-semibold text-foreground">{group.owner.name || "社区成员"}</div>
                </div>
              </div>
              {!group.joined ? (
                <Button onClick={joinGroup} disabled={joining}>
                  <Users className="size-4" />
                  {joining ? "加入中..." : "加入学习小组"}
                </Button>
              ) : (
                <Badge variant="outline" className="w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                  已加入，当前身份：{group.role === "owner" ? "组长" : "成员"}
                </Badge>
              )}
            </CardContent>
          </Card>

          {message ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <PlusCircle className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">发布小组讨论</h2>
              </div>
              <Input
                placeholder="标题"
                value={postForm.title}
                onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                disabled={!group.joined}
              />
              <select
                className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                value={postForm.kind}
                onChange={(event) => setPostForm((current) => ({ ...current, kind: event.target.value }))}
                disabled={!group.joined}
              >
                {POST_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-[140px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                placeholder={group.joined ? "写下你的题解思路、训练方法或提问。" : "加入学习小组后才能发帖。"}
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                disabled={!group.joined}
              />
              <Button onClick={submitPost} disabled={!group.joined || submittingPost}>
                <MessageSquare className="size-4" />
                {submittingPost ? "发布中..." : "发布讨论"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">小组讨论</h2>
              </div>
              <div className="space-y-4">
                {feed.length === 0 ? (
                  <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                    这个小组还没有讨论内容，先发第一条吧。
                  </div>
                ) : (
                  feed.map((post) => (
                    <div key={post.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-5 py-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          {getCommunityPostKindLabel(post.kind)}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-foreground">{post.title}</h3>
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                        {post.content.length > 220 ? `${post.content.slice(0, 220)}...` : post.content}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <div>
                          {post.author.name || "匿名同学"} · {new Date(post.createdAt).toLocaleString("zh-CN")}
                        </div>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/discuss/posts/${post.id}`}>查看详情</Link>
                        </Button>
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
                <h2 className="text-xl font-semibold text-foreground">成员</h2>
              </div>
              <div className="space-y-3">
                {group.members.map((member) => (
                  <div key={member.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-foreground">{member.name || "社区成员"}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.role === "owner" ? "组长" : "成员"} · {new Date(member.joinedAt).toLocaleDateString("zh-CN")}
                        </div>
                      </div>
                      <Badge variant="secondary">{member.role === "owner" ? "Owner" : "Member"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
