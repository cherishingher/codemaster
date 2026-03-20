"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { CheckCircle2, EyeOff, FileWarning, XCircle } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  type DiscussionModerationCommentListResponse,
  type DiscussionModerationPostListResponse,
  type DiscussionModerationReportListResponse,
  formatDiscussionDateTime,
  getDiscussionPostTypeLabel,
  getDiscussionPostTypeTone,
  getDiscussionReportReasonLabel,
} from "@/lib/discussions"
import { useAuth } from "@/lib/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PAGE_SIZE = 10

function canModerate(roles?: string[]) {
  return Boolean(roles?.includes("admin") || roles?.includes("moderator"))
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        第 {page} / {totalPages} 页
      </span>
      <Button variant="outline" size="sm" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>
        上一页
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        下一页
      </Button>
    </div>
  )
}

export function DiscussionModerationPage() {
  const { user, loading } = useAuth()
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [postPage, setPostPage] = React.useState(1)
  const [commentPage, setCommentPage] = React.useState(1)
  const [reportPage, setReportPage] = React.useState(1)
  const [postKeyword, setPostKeyword] = React.useState("")
  const [commentKeyword, setCommentKeyword] = React.useState("")

  const postParams = React.useMemo(
    () => ({
      page: String(postPage),
      pageSize: String(PAGE_SIZE),
      auditStatus: "manual_review",
      ...(postKeyword.trim() ? { keyword: postKeyword.trim() } : {}),
    }),
    [postKeyword, postPage],
  )

  const commentParams = React.useMemo(
    () => ({
      page: String(commentPage),
      pageSize: String(PAGE_SIZE),
      auditStatus: "manual_review",
      ...(commentKeyword.trim() ? { keyword: commentKeyword.trim() } : {}),
    }),
    [commentKeyword, commentPage],
  )

  const reportParams = React.useMemo(
    () => ({
      page: String(reportPage),
      pageSize: String(PAGE_SIZE),
      status: "pending",
    }),
    [reportPage],
  )

  const posts = useSWR<DiscussionModerationPostListResponse>(
    canModerate(user?.roles) ? `/discussions/moderation/posts?${new URLSearchParams(postParams).toString()}` : null,
    () => api.discussions.moderation.posts.list<DiscussionModerationPostListResponse>(postParams),
  )

  const comments = useSWR<DiscussionModerationCommentListResponse>(
    canModerate(user?.roles)
      ? `/discussions/moderation/comments?${new URLSearchParams(commentParams).toString()}`
      : null,
    () => api.discussions.moderation.comments.list<DiscussionModerationCommentListResponse>(commentParams),
  )

  const reports = useSWR<DiscussionModerationReportListResponse>(
    canModerate(user?.roles)
      ? `/discussions/moderation/reports?${new URLSearchParams(reportParams).toString()}`
      : null,
    () => api.discussions.moderation.reports.list<DiscussionModerationReportListResponse>(reportParams),
  )

  const runAction = React.useCallback(async (task: () => Promise<unknown>, successMessage: string) => {
    try {
      await task()
      setMessage(successMessage)
      setErrorMessage("")
      await Promise.all([posts.mutate(), comments.mutate(), reports.mutate()])
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "操作失败")
    }
  }, [comments, posts, reports])

  if (loading) {
    return (
      <div className="page-wrap py-10">
        <Card className="bg-background">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">审核后台加载中...</CardContent>
        </Card>
      </div>
    )
  }

  if (!canModerate(user?.roles)) {
    return (
      <div className="page-wrap py-10">
        <Card className="bg-background">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            你没有讨论区审核权限。
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Discussion Moderation</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">讨论审核后台</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            这里集中处理待审核帖子、评论和举报工单，优先关注比赛期内容、剧透风险和明显灌水。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">返回运营后台</Link>
        </Button>
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

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">待审帖子</TabsTrigger>
          <TabsTrigger value="comments">待审评论</TabsTrigger>
          <TabsTrigger value="reports">举报工单</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-5">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  className="max-w-md"
                  placeholder="搜索帖子标题或正文"
                  value={postKeyword}
                  onChange={(event) => {
                    setPostKeyword(event.target.value)
                    setPostPage(1)
                  }}
                />
                <Pager
                  page={posts.data?.meta.page ?? postPage}
                  totalPages={posts.data?.meta.totalPages ?? 1}
                  onChange={setPostPage}
                />
              </div>
            </CardContent>
          </Card>

          {(posts.data?.data ?? []).map((post) => (
            <Card key={post.id} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={getDiscussionPostTypeTone(post.postType)}>
                    {getDiscussionPostTypeLabel(post.postType)}
                  </Badge>
                  <Badge variant="secondary">审核 {post.auditStatus}</Badge>
                  <Badge variant="secondary">展示 {post.displayStatus}</Badge>
                  {post.problem ? <Badge variant="outline">题目：{post.problem.title}</Badge> : null}
                  {post.contest ? <Badge variant="outline">比赛：{post.contest.name}</Badge> : null}
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-foreground">{post.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {post.author.name || "匿名同学"} · {formatDiscussionDateTime(post.createdAt)} · 举报 {post.reportCount}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">{post.excerpt || "暂无摘要"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.posts.audit(post.id, { auditStatus: "approved" }),
                        "帖子已审核通过",
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    通过
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.posts.audit(post.id, { auditStatus: "rejected" }),
                        "帖子已驳回",
                      )
                    }
                  >
                    <XCircle className="size-4" />
                    驳回
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () =>
                          api.discussions.moderation.posts.action(post.id, {
                            actionType: post.displayStatus === "hidden" ? "unhide" : "hide",
                          }),
                        post.displayStatus === "hidden" ? "帖子已恢复显示" : "帖子已隐藏",
                      )
                    }
                  >
                    <EyeOff className="size-4" />
                    {post.displayStatus === "hidden" ? "恢复显示" : "隐藏"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () =>
                          api.discussions.moderation.posts.action(post.id, {
                            actionType: post.isLocked ? "unlock" : "lock",
                          }),
                        post.isLocked ? "帖子已解锁" : "帖子已锁定",
                      )
                    }
                  >
                    {post.isLocked ? "解锁" : "锁帖"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/discuss/topics/${post.id}`}>查看详情</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="comments" className="space-y-5">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  className="max-w-md"
                  placeholder="搜索评论正文"
                  value={commentKeyword}
                  onChange={(event) => {
                    setCommentKeyword(event.target.value)
                    setCommentPage(1)
                  }}
                />
                <Pager
                  page={comments.data?.meta.page ?? commentPage}
                  totalPages={comments.data?.meta.totalPages ?? 1}
                  onChange={setCommentPage}
                />
              </div>
            </CardContent>
          </Card>

          {(comments.data?.data ?? []).map((comment) => (
            <Card key={comment.id} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">审核 {comment.auditStatus}</Badge>
                  <Badge variant="secondary">展示 {comment.displayStatus}</Badge>
                  <Badge variant="outline">{getDiscussionPostTypeLabel(comment.post.postType)}</Badge>
                  <Badge variant="outline">楼层 #{comment.floorNo || "-"}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-base font-semibold text-foreground">{comment.post.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {comment.author.name || "匿名同学"} · {formatDiscussionDateTime(comment.createdAt)} · 举报 {comment.reportCount}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">{comment.contentPreview || "暂无正文预览"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.comments.audit(comment.id, { auditStatus: "approved" }),
                        "评论已审核通过",
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    通过
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.comments.audit(comment.id, { auditStatus: "rejected" }),
                        "评论已驳回",
                      )
                    }
                  >
                    <XCircle className="size-4" />
                    驳回
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () =>
                          api.discussions.moderation.comments.action(comment.id, {
                            actionType: comment.displayStatus === "hidden" ? "unhide" : "hide",
                          }),
                        comment.displayStatus === "hidden" ? "评论已恢复显示" : "评论已隐藏",
                      )
                    }
                  >
                    <EyeOff className="size-4" />
                    {comment.displayStatus === "hidden" ? "恢复显示" : "隐藏"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/discuss/topics/${comment.post.id}`}>查看所在帖子</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-5">
          <Card className="bg-background">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
              <div className="text-sm text-muted-foreground">默认只看待处理举报。处理后会自动从当前列表移出。</div>
              <Pager
                page={reports.data?.meta.page ?? reportPage}
                totalPages={reports.data?.meta.totalPages ?? 1}
                onChange={setReportPage}
              />
            </CardContent>
          </Card>

          {(reports.data?.data ?? []).map((report) => (
            <Card key={report.id} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{report.targetType === "post" ? "帖子举报" : "评论举报"}</Badge>
                  <Badge variant="secondary">{getDiscussionReportReasonLabel(report.reasonCode)}</Badge>
                  <Badge variant="secondary">状态 {report.status}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    举报人：{report.reporter?.name || report.reporter?.id || "未知用户"} · {formatDiscussionDateTime(report.createdAt)}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {report.targetPreview?.title || `目标 ${report.targetId}`}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {report.reasonText || report.targetPreview?.excerpt || "暂无补充说明"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.reports.resolve(report.id, { status: "accepted" }),
                        "举报已标记为成立",
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    举报成立
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.reports.resolve(report.id, { status: "rejected" }),
                        "举报已驳回",
                      )
                    }
                  >
                    <XCircle className="size-4" />
                    驳回举报
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(
                        () => api.discussions.moderation.reports.resolve(report.id, { status: "closed" }),
                        "举报工单已关闭",
                      )
                    }
                  >
                    <FileWarning className="size-4" />
                    关闭工单
                  </Button>
                  {report.targetType === "post" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/discuss/topics/${report.targetId}`}>查看帖子</Link>
                    </Button>
                  ) : report.targetPreview?.postId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/discuss/topics/${report.targetPreview.postId}`}>查看评论所在帖子</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
