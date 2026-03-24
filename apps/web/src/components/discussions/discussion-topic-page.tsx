"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { AlertTriangle, ArrowLeft, CheckCircle2, Heart, MessageSquare, Pencil, Send, ShieldAlert, Star, Trash2, Trophy } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  type DiscussionComment,
  type DiscussionCommentListResponse,
  type DiscussionMutationResponse,
  type DiscussionPostDetailResponse,
  type DiscussionReportReasonCode,
  DISCUSSION_REPORT_REASON_OPTIONS,
  formatDiscussionDateTime,
  getDiscussionCommentPlaceholder,
  getDiscussionComposerHint,
  getDiscussionPostTypeLabel,
  getDiscussionPostTypeTone,
} from "@/lib/discussions"
import { useAuth } from "@/lib/hooks/use-auth"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"
import { ProblemRichText } from "@/components/problems/problem-markdown"
import { PaginationBar } from "@/components/patterns/pagination-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type DiscussionTopicPageProps = {
  topicId: string
}

type ReplyTarget = {
  parentCommentId: string
  replyToUserId?: string | null
  label: string
}

type ReportDraft = {
  targetType: "post" | "comment"
  targetId: string
  reasonCode: DiscussionReportReasonCode
  reasonText: string
}

const COMMENT_PAGE_SIZE = 20
const EDITOR_TEXTAREA_CLASS =
  "min-h-[180px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"

function isModerator(roles?: string[]) {
  return Boolean(roles?.includes("admin") || roles?.includes("moderator"))
}

export function DiscussionTopicPage({ topicId }: DiscussionTopicPageProps) {
  const router = useRouter()
  const { user, loggedIn } = useAuth()
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [commentValue, setCommentValue] = React.useState("")
  const [replyTarget, setReplyTarget] = React.useState<ReplyTarget | null>(null)
  const [commentPage, setCommentPage] = React.useState(1)
  const [commentPageInput, setCommentPageInput] = React.useState("1")
  const [submittingComment, setSubmittingComment] = React.useState(false)
  const [togglingSolved, setTogglingSolved] = React.useState(false)
  const [postLiked, setPostLiked] = React.useState(false)
  const [postFavorited, setPostFavorited] = React.useState(false)
  const [postLikeCount, setPostLikeCount] = React.useState(0)
  const [postFavoriteCount, setPostFavoriteCount] = React.useState(0)
  const [editingPost, setEditingPost] = React.useState(false)
  const [editingPostTitle, setEditingPostTitle] = React.useState("")
  const [editingPostContent, setEditingPostContent] = React.useState("")
  const [savingPost, setSavingPost] = React.useState(false)
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null)
  const [editingCommentValue, setEditingCommentValue] = React.useState("")
  const [savingCommentId, setSavingCommentId] = React.useState<string | null>(null)
  const [reportDraft, setReportDraft] = React.useState<ReportDraft | null>(null)
  const [submittingReport, setSubmittingReport] = React.useState(false)

  const { data: postData, isLoading: postLoading, mutate: mutatePost } = useSWR<DiscussionPostDetailResponse>(
    topicId ? `/discussions/posts/${topicId}` : null,
    () => api.discussions.posts.get<DiscussionPostDetailResponse>(topicId),
    { revalidateOnFocus: false },
  )

  const { data: commentsData, isLoading: commentsLoading, mutate: mutateComments } =
    useSWR<DiscussionCommentListResponse>(
      topicId ? `/discussions/posts/${topicId}/comments?page=${commentPage}&pageSize=${COMMENT_PAGE_SIZE}` : null,
      () =>
        api.discussions.posts.comments<DiscussionCommentListResponse>(topicId, {
          page: String(commentPage),
          pageSize: String(COMMENT_PAGE_SIZE),
        }),
      { revalidateOnFocus: false },
    )

  const post = postData?.data
  const comments = commentsData?.data ?? []
  const commentsMeta = commentsData?.meta ?? {
    total: 0,
    page: commentPage,
    pageSize: COMMENT_PAGE_SIZE,
    totalPages: 1,
  }

  React.useEffect(() => {
    setCommentPageInput(String(commentPage))
  }, [commentPage])

  React.useEffect(() => {
    if (!post) return
    setPostLiked(Boolean(post.viewerState?.liked))
    setPostFavorited(Boolean(post.viewerState?.favorited))
    setPostLikeCount(post.likeCount)
    setPostFavoriteCount(post.favoriteCount)
    setEditingPostTitle(post.title)
    setEditingPostContent(post.contentMarkdown)
  }, [post])

  const commentsPaginationItems = buildPaginationItems(commentsMeta.page, commentsMeta.totalPages)
  const commentsPaginationRange = getPaginationRange({
    page: commentsMeta.page,
    pageSize: commentsMeta.pageSize,
    total: commentsMeta.total,
    visibleCount: comments.length,
  })

  const canManageQuestion =
    Boolean(post) &&
    post?.postType === "question" &&
    Boolean(user && (user.id === post.author.id || isModerator(user.roles)))

  const canManagePost = Boolean(post && user && (user.id === post.author.id || isModerator(user.roles)))
  const canManageComment = React.useCallback(
    (comment: DiscussionComment) => Boolean(user && (user.id === comment.authorId || isModerator(user.roles))),
    [user],
  )

  const togglePostLike = React.useCallback(async () => {
    if (!loggedIn || !post) {
      setErrorMessage("登录后才能点赞")
      return
    }

    try {
      const response = postLiked
        ? await api.discussions.posts.unlike<DiscussionMutationResponse>(post.id)
        : await api.discussions.posts.like<DiscussionMutationResponse>(post.id)
      setPostLiked(Boolean(response.data.liked))
      setPostLikeCount(response.data.likeCount ?? postLikeCount)
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "点赞失败")
    }
  }, [loggedIn, post, postLikeCount, postLiked])

  const togglePostFavorite = React.useCallback(async () => {
    if (!loggedIn || !post) {
      setErrorMessage("登录后才能收藏")
      return
    }

    try {
      const response = postFavorited
        ? await api.discussions.posts.unfavorite<DiscussionMutationResponse>(post.id)
        : await api.discussions.posts.favorite<DiscussionMutationResponse>(post.id)
      setPostFavorited(Boolean(response.data.favorited))
      setPostFavoriteCount(response.data.favoriteCount ?? postFavoriteCount)
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "收藏失败")
    }
  }, [loggedIn, post, postFavoriteCount, postFavorited])

  const submitComment = React.useCallback(async () => {
    if (!loggedIn || !post) {
      setErrorMessage("登录后才能发表评论")
      return
    }

    setSubmittingComment(true)
    setMessage("")
    setErrorMessage("")
    try {
      await api.discussions.posts.createComment<DiscussionMutationResponse>(post.id, {
        contentMarkdown: commentValue.trim(),
        parentCommentId: replyTarget?.parentCommentId,
        replyToUserId: replyTarget?.replyToUserId ?? undefined,
      })
      setCommentValue("")
      setReplyTarget(null)
      setMessage("评论已发布")
      await Promise.all([mutateComments(), mutatePost()])
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "评论失败")
    } finally {
      setSubmittingComment(false)
    }
  }, [commentValue, loggedIn, mutateComments, mutatePost, post, replyTarget])

  const toggleCommentLike = React.useCallback(
    async (comment: DiscussionComment) => {
      if (!loggedIn) {
        setErrorMessage("登录后才能点赞评论")
        return
      }

      try {
        if (comment.viewerLiked) {
          await api.discussions.comments.unlike<DiscussionMutationResponse>(comment.id)
        } else {
          await api.discussions.comments.like<DiscussionMutationResponse>(comment.id)
        }
        setErrorMessage("")
        await mutateComments()
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "评论点赞失败")
      }
    },
    [loggedIn, mutateComments],
  )

  const setBestComment = React.useCallback(
    async (commentId: string) => {
      if (!post) return

      try {
        await api.discussions.moderation.setBestComment(post.id, commentId)
        setMessage("最佳回复已更新")
        setErrorMessage("")
        await mutatePost()
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "设置最佳回复失败")
      }
    },
    [mutatePost, post],
  )

  const toggleSolved = React.useCallback(async () => {
    if (!post) return

    setTogglingSolved(true)
    try {
      await api.discussions.moderation.markSolved(post.id, !post.isSolved)
      setMessage(post.isSolved ? "已取消已解决状态" : "已标记为已解决")
      setErrorMessage("")
      await mutatePost()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "更新状态失败")
    } finally {
      setTogglingSolved(false)
    }
  }, [mutatePost, post])

  const savePostEdit = React.useCallback(async () => {
    if (!post) return

    if (editingPostTitle.trim().length < 2 || editingPostContent.trim().length < 2) {
      setErrorMessage("标题和正文都需要至少 2 个字。")
      return
    }

    setSavingPost(true)
    try {
      await api.discussions.posts.update<DiscussionPostDetailResponse>(post.id, {
        title: editingPostTitle.trim(),
        contentMarkdown: editingPostContent.trim(),
      })
      setEditingPost(false)
      setMessage("帖子已更新")
      setErrorMessage("")
      await mutatePost()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "更新帖子失败")
    } finally {
      setSavingPost(false)
    }
  }, [editingPostContent, editingPostTitle, mutatePost, post])

  const deletePost = React.useCallback(async () => {
    if (!post) return
    if (!window.confirm("确认删除这条讨论吗？删除后会从公开列表中移除。")) return

    try {
      await api.discussions.posts.delete<DiscussionMutationResponse>(post.id)
      router.push("/discuss")
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "删除帖子失败")
    }
  }, [post, router])

  const startEditComment = React.useCallback((comment: DiscussionComment) => {
    setEditingCommentId(comment.id)
    setEditingCommentValue(comment.contentMarkdown)
    setReplyTarget(null)
  }, [])

  const saveCommentEdit = React.useCallback(
    async (commentId: string) => {
      if (!editingCommentValue.trim()) {
        setErrorMessage("评论内容不能为空。")
        return
      }

      setSavingCommentId(commentId)
      try {
        await api.discussions.comments.update<DiscussionMutationResponse>(commentId, {
          contentMarkdown: editingCommentValue.trim(),
        })
        setEditingCommentId(null)
        setEditingCommentValue("")
        setMessage("评论已更新")
        setErrorMessage("")
        await mutateComments()
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "更新评论失败")
      } finally {
        setSavingCommentId(null)
      }
    },
    [editingCommentValue, mutateComments],
  )

  const deleteComment = React.useCallback(
    async (commentId: string) => {
      if (!window.confirm("确认删除这条评论吗？")) return

      try {
        await api.discussions.comments.delete<DiscussionMutationResponse>(commentId)
        setMessage("评论已删除")
        setErrorMessage("")
        if (editingCommentId === commentId) {
          setEditingCommentId(null)
          setEditingCommentValue("")
        }
        await Promise.all([mutateComments(), mutatePost()])
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "删除评论失败")
      }
    },
    [editingCommentId, mutateComments, mutatePost],
  )

  const submitReport = React.useCallback(async () => {
    if (!loggedIn || !reportDraft) {
      setErrorMessage("登录后才能举报内容")
      return
    }

    setSubmittingReport(true)
    try {
      await api.discussions.reports.create<DiscussionMutationResponse>({
        targetType: reportDraft.targetType,
        targetId: reportDraft.targetId,
        reasonCode: reportDraft.reasonCode,
        reasonText: reportDraft.reasonText.trim() || undefined,
      })
      setReportDraft(null)
      setMessage("举报已提交，管理员会尽快处理。")
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "举报提交失败")
    } finally {
      setSubmittingReport(false)
    }
  }, [loggedIn, reportDraft])

  if (postLoading) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <Card className="bg-background">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">讨论内容加载中...</CardContent>
        </Card>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="page-wrap py-10 md:py-14">
        <Card className="bg-background">
          <CardContent className="px-6 py-8 text-sm text-muted-foreground">
            讨论内容不存在、未公开，或你没有查看权限。
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/discuss">
            <ArrowLeft className="size-4" />
            返回讨论区
          </Link>
        </Button>
        {post.problemId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/problems/${post.problemId}`}>查看关联题目</Link>
          </Button>
        ) : null}
        {post.contestId ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/contests/${post.contestId}`}>查看关联比赛</Link>
          </Button>
        ) : null}
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

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="bg-background">
          <CardContent className="space-y-5 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={getDiscussionPostTypeTone(post.postType)}>
                {getDiscussionPostTypeLabel(post.postType)}
              </Badge>
              {post.isPinned ? <Badge variant="secondary">置顶</Badge> : null}
              {post.isFeatured ? <Badge variant="secondary">精选</Badge> : null}
              {post.isRecommended ? <Badge variant="secondary">推荐</Badge> : null}
              {post.postType === "question" && post.isSolved ? <Badge variant="secondary">已解决</Badge> : null}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>{post.author.name || "匿名同学"}</span>
                <span>{formatDiscussionDateTime(post.createdAt)}</span>
                <span>浏览 {post.viewCount}</span>
                <span>评论 {post.commentCount}</span>
                <span>回复 {post.replyCount}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManagePost ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditingPost((current) => !current)}>
                    <Pencil className="size-4" />
                    {editingPost ? "取消编辑" : "编辑帖子"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={deletePost}>
                    <Trash2 className="size-4" />
                    删除帖子
                  </Button>
                </>
              ) : null}
              {loggedIn ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReportDraft({
                      targetType: "post",
                      targetId: post.id,
                      reasonCode: "spoiler",
                      reasonText: "",
                    })
                  }
                >
                  <ShieldAlert className="size-4" />
                  举报帖子
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.tagName}
                </Badge>
              ))}
            </div>

            {editingPost ? (
              <div className="space-y-4 rounded-[1.3rem] border-[2px] border-primary/25 bg-card px-5 py-5">
                <div className="space-y-2">
                  <Label htmlFor="discussion-post-title">标题</Label>
                  <Input
                    id="discussion-post-title"
                    value={editingPostTitle}
                    onChange={(event) => setEditingPostTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discussion-post-content">正文 Markdown</Label>
                  <textarea
                    id="discussion-post-content"
                    className={EDITOR_TEXTAREA_CLASS}
                    value={editingPostContent}
                    onChange={(event) => setEditingPostContent(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={savePostEdit} disabled={savingPost}>
                    <Pencil className="size-4" />
                    {savingPost ? "保存中..." : "保存帖子"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingPost(false)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-5 py-5">
                <ProblemRichText content={post.contentMarkdown} mode="markdown" className="max-w-none" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">互动与状态</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={togglePostLike} variant={postLiked ? "default" : "outline"}>
                  <Heart className="size-4" />
                  点赞 {postLikeCount}
                </Button>
                <Button onClick={togglePostFavorite} variant={postFavorited ? "default" : "outline"}>
                  <Star className="size-4" />
                  收藏 {postFavoriteCount}
                </Button>
              </div>
              {canManageQuestion ? (
                <Button onClick={toggleSolved} variant="secondary" disabled={togglingSolved} className="w-full">
                  <CheckCircle2 className="size-4" />
                  {post.isSolved ? "取消已解决" : "标记为已解决"}
                </Button>
              ) : null}
              <div className="rounded-[1.2rem] border-[2px] border-border/70 bg-card px-4 py-4 text-sm text-muted-foreground">
                {post.postType === "question"
                  ? "问答帖支持最佳回复与已解决状态。提问时建议优先描述思路和卡点，回复时优先给方向、边界与错因。"
                  : getDiscussionComposerHint(post.postType)}
              </div>
            </CardContent>
          </Card>

          {reportDraft ? (
            <Card className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">举报内容</h2>
                </div>
                <div className="rounded-[1.2rem] border-[2px] border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
                  当前举报对象：
                  {reportDraft.targetType === "post" ? " 帖子正文" : " 评论内容"}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discussion-report-reason">举报原因</Label>
                  <select
                    id="discussion-report-reason"
                    className="h-11 w-full rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                    value={reportDraft.reasonCode}
                    onChange={(event) =>
                      setReportDraft((current) =>
                        current
                          ? {
                              ...current,
                              reasonCode: event.target.value as DiscussionReportReasonCode,
                            }
                          : current,
                      )
                    }
                  >
                    {DISCUSSION_REPORT_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discussion-report-detail">补充说明（选填）</Label>
                  <textarea
                    id="discussion-report-detail"
                    className={EDITOR_TEXTAREA_CLASS}
                    value={reportDraft.reasonText}
                    onChange={(event) =>
                      setReportDraft((current) =>
                        current
                          ? {
                              ...current,
                              reasonText: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="例如：赛中贴出关键做法、直接泄露正解、广告引流或辱骂攻击。"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={submitReport} disabled={submittingReport}>
                    <ShieldAlert className="size-4" />
                    {submittingReport ? "提交中..." : "提交举报"}
                  </Button>
                  <Button variant="outline" onClick={() => setReportDraft(null)} disabled={submittingReport}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">参与评论</h2>
              </div>
              {replyTarget ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] border-[2px] border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
                  <span>{replyTarget.label}</span>
                  <Button variant="ghost" size="sm" onClick={() => setReplyTarget(null)}>
                    取消回复
                  </Button>
                </div>
              ) : null}
              <textarea
                className="min-h-[180px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                placeholder={
                  loggedIn ? getDiscussionCommentPlaceholder(post.postType) : "登录后才能参与评论。"
                }
                value={commentValue}
                onChange={(event) => setCommentValue(event.target.value)}
                disabled={!loggedIn}
              />
              <Button onClick={submitComment} disabled={!loggedIn || submittingComment || !commentValue.trim()}>
                <Send className="size-4" />
                {submittingComment ? "提交中..." : "发布评论"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-foreground">评论区</div>
            <div className="text-sm text-muted-foreground">仅公开通过审核的评论会显示在这里。</div>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            共 {commentsMeta.total} 条一级评论
          </Badge>
        </div>

        {commentsLoading ? (
          <Card className="bg-background">
            <CardContent className="px-6 py-8 text-sm text-muted-foreground">评论加载中...</CardContent>
          </Card>
        ) : null}

        {!commentsLoading && comments.length === 0 ? (
          <Card className="bg-background">
            <CardContent className="px-6 py-8 text-sm text-muted-foreground">
              还没有评论，成为第一个补充思路的人。
            </CardContent>
          </Card>
        ) : null}

        {comments.map((comment) => (
          <Card key={comment.id} className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-semibold text-foreground">
                  #{comment.floorNo} {comment.author.name || "匿名同学"}
                </div>
                <div className="text-xs text-muted-foreground">{formatDiscussionDateTime(comment.createdAt)}</div>
                {post.bestCommentId === comment.id ? <Badge variant="secondary">最佳回复</Badge> : null}
              </div>
              {editingCommentId === comment.id ? (
                <div className="space-y-3 rounded-[1.2rem] border-[2px] border-primary/25 bg-card px-4 py-4">
                  <textarea
                    className={EDITOR_TEXTAREA_CLASS}
                    value={editingCommentValue}
                    onChange={(event) => setEditingCommentValue(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => saveCommentEdit(comment.id)} disabled={savingCommentId === comment.id}>
                      <Pencil className="size-4" />
                      {savingCommentId === comment.id ? "保存中..." : "保存评论"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingCommentId(null)
                        setEditingCommentValue("")
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <ProblemRichText content={comment.contentMarkdown} mode="markdown" className="max-w-none" />
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleCommentLike(comment)}>
                  <Heart className="size-4" />
                  点赞 {comment.likeCount}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReplyTarget({
                      parentCommentId: comment.id,
                      replyToUserId: comment.author.id,
                      label: `回复 ${comment.author.name || "匿名同学"} · #${comment.floorNo}`,
                    })
                  }
                >
                  <MessageSquare className="size-4" />
                  回复
                </Button>
                {canManageQuestion ? (
                  <Button variant="outline" size="sm" onClick={() => setBestComment(comment.id)}>
                    <CheckCircle2 className="size-4" />
                    设为最佳
                  </Button>
                ) : null}
                {canManageComment(comment) ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => startEditComment(comment)}>
                      <Pencil className="size-4" />
                      编辑
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteComment(comment.id)}>
                      <Trash2 className="size-4" />
                      删除
                    </Button>
                  </>
                ) : null}
                {loggedIn ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setReportDraft({
                        targetType: "comment",
                        targetId: comment.id,
                        reasonCode: "spoiler",
                        reasonText: "",
                      })
                    }
                  >
                    <ShieldAlert className="size-4" />
                    举报
                  </Button>
                ) : null}
              </div>

              {comment.replies?.length ? (
                <div className="space-y-3 rounded-[1.2rem] border-[2px] border-border/70 bg-card px-4 py-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="rounded-[1.1rem] border-[2px] border-border/70 bg-background px-4 py-4">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <div className="text-sm font-semibold text-foreground">{reply.author.name || "匿名同学"}</div>
                        <div className="text-xs text-muted-foreground">{formatDiscussionDateTime(reply.createdAt)}</div>
                        {post.bestCommentId === reply.id ? <Badge variant="secondary">最佳回复</Badge> : null}
                      </div>
                      {editingCommentId === reply.id ? (
                        <div className="space-y-3 rounded-[1.2rem] border-[2px] border-primary/25 bg-card px-4 py-4">
                          <textarea
                            className={EDITOR_TEXTAREA_CLASS}
                            value={editingCommentValue}
                            onChange={(event) => setEditingCommentValue(event.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => saveCommentEdit(reply.id)} disabled={savingCommentId === reply.id}>
                              <Pencil className="size-4" />
                              {savingCommentId === reply.id ? "保存中..." : "保存评论"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingCommentId(null)
                                setEditingCommentValue("")
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <ProblemRichText content={reply.contentMarkdown} mode="markdown" className="max-w-none" />
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleCommentLike(reply)}>
                          <Heart className="size-4" />
                          点赞 {reply.likeCount}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setReplyTarget({
                              parentCommentId: comment.id,
                              replyToUserId: reply.author.id,
                              label: `回复 ${reply.author.name || "匿名同学"}`,
                            })
                          }
                        >
                          <MessageSquare className="size-4" />
                          回复
                        </Button>
                        {canManageQuestion ? (
                          <Button variant="outline" size="sm" onClick={() => setBestComment(reply.id)}>
                            <CheckCircle2 className="size-4" />
                            设为最佳
                          </Button>
                        ) : null}
                        {canManageComment(reply) ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEditComment(reply)}>
                              <Pencil className="size-4" />
                              编辑
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => deleteComment(reply.id)}>
                              <Trash2 className="size-4" />
                              删除
                            </Button>
                          </>
                        ) : null}
                        {loggedIn ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setReportDraft({
                                targetType: "comment",
                                targetId: reply.id,
                                reasonCode: "spoiler",
                                reasonText: "",
                              })
                            }
                          >
                            <ShieldAlert className="size-4" />
                            举报
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        <PaginationBar
          range={commentsPaginationRange}
          currentPage={commentsMeta.page}
          totalPages={commentsMeta.totalPages}
          items={commentsPaginationItems}
          loading={commentsLoading}
          pageNoun="条评论"
          pageInput={commentPageInput}
          canJumpToPage={
            Boolean(commentPageInput) &&
            Number(commentPageInput) >= 1 &&
            Number(commentPageInput) <= commentsMeta.totalPages
          }
          onPageInputChange={setCommentPageInput}
          onPageInputSubmit={() => {
            const nextPage = Number(commentPageInput)
            if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > commentsMeta.totalPages) return
            setCommentPage(nextPage)
          }}
          onPageChange={setCommentPage}
        />
      </div>
    </div>
  )
}
