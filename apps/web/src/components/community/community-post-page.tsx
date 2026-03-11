"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  getCommunityPostKindLabel,
  type CommunityMutationResponse,
  type CommunityPostDetailResponse,
} from "@/lib/community"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type CommunityPostPageProps = {
  postId: string
}

export function CommunityPostPage({ postId }: CommunityPostPageProps) {
  const { loggedIn } = useAuth()
  const [comment, setComment] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const { data, mutate } = useSWR<CommunityPostDetailResponse>(`/community/posts/${postId}`, () =>
    api.community.feed.getPost<CommunityPostDetailResponse>(postId),
  )

  const post = data?.data

  const submitComment = React.useCallback(async () => {
    if (!loggedIn) {
      setErrorMessage("登录后才能参与评论")
      return
    }

    setSubmitting(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.community.feed.comment<CommunityMutationResponse>(postId, { content: comment })
      setComment("")
      setMessage("评论已发布")
      await mutate()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "评论失败")
    } finally {
      setSubmitting(false)
    }
  }, [comment, loggedIn, mutate, postId])

  if (!data) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          正在加载讨论内容...
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          讨论内容不存在或已下线。
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={post.group ? `/discuss/groups/${post.group.slug}` : "/discuss"}>
            <ArrowLeft className="size-4" />
            {post.group ? "返回学习小组" : "返回社区"}
          </Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {getCommunityPostKindLabel(post.kind)}
            </Badge>
            {post.group ? <Badge variant="secondary">小组：{post.group.name}</Badge> : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{post.title}</h1>
          <div className="text-sm text-muted-foreground">
            {post.author.name || "匿名同学"} · {new Date(post.createdAt).toLocaleString("zh-CN")}
          </div>
          <div className="whitespace-pre-line text-sm leading-8 text-foreground">{post.content}</div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">讨论回复</h2>
            </div>
            <div className="space-y-4">
              {post.comments.length === 0 ? (
                <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                  还没有回复，成为第一个参与讨论的人。
                </div>
              ) : (
                post.comments.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-4">
                    <div className="text-sm font-medium text-foreground">{item.author.name || "匿名同学"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("zh-CN")}
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-xl font-semibold text-foreground">参与评论</h2>
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
            <textarea
              className="min-h-[180px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
              placeholder={loggedIn ? "写下你的思路、建议或补充。" : "登录后才能参与评论。"}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={!loggedIn}
            />
            <Button onClick={submitComment} disabled={!loggedIn || submitting}>
              <MessageSquare className="size-4" />
              {submitting ? "提交中..." : "发布评论"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
