"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, CheckCircle2, Heart, MessageSquare, Send, Star, Trophy } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  type DiscussionComment,
  type DiscussionCommentListResponse,
  type DiscussionMutationResponse,
  type DiscussionPostDetailResponse,
  formatDiscussionDateTime,
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

type DiscussionTopicPageProps = {
  topicId: string
}

type ReplyTarget = {
  parentCommentId: string
  replyToUserId?: string | null
  label: string
}

const COMMENT_PAGE_SIZE = 20

function isModerator(roles?: string[]) {
  return Boolean(roles?.includes("admin") || roles?.includes("moderator"))
}

export function DiscussionTopicPage({ topicId }: DiscussionTopicPageProps) {
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
              {post.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.tagName}
                </Badge>
              ))}
            </div>

            <div className="rounded-[1.3rem] border-[2px] border-border bg-card px-5 py-5">
              <ProblemRichText content={post.contentMarkdown} mode="markdown" className="max-w-none" />
            </div>
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
                  ? "问答帖支持最佳回复与已解决状态。"
                  : "题目讨论、题解和比赛复盘都共享统一的评论区与互动能力。"}
              </div>
            </CardContent>
          </Card>

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
                placeholder={loggedIn ? "支持 Markdown，写下你的补充、疑问或建议。" : "登录后才能参与评论。"}
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
              <ProblemRichText content={comment.contentMarkdown} mode="markdown" className="max-w-none" />
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
                      <ProblemRichText content={reply.contentMarkdown} mode="markdown" className="max-w-none" />
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
