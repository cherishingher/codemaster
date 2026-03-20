"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { AlertTriangle, BookOpen, Filter, Flame, MessageSquare, PenSquare, Search } from "lucide-react"
import { ApiError, api } from "@/lib/api-client"
import {
  type DiscussionQuestionHelpMode,
  type DiscussionPostSort,
  type DiscussionPostType,
  type DiscussionPostListResponse,
  type DiscussionPostDetailResponse,
  DISCUSSION_POST_TYPE_OPTIONS,
  DISCUSSION_QUESTION_HELP_MODE_OPTIONS,
  DISCUSSION_SORT_OPTIONS,
  buildStructuredQuestionMarkdown,
  formatDiscussionDateTime,
  getDiscussionBodyPlaceholder,
  getDiscussionComposerHint,
  getDiscussionContextBinding,
  getDiscussionPostTypeLabel,
  getDiscussionPostTypeTone,
  getDiscussionTitlePlaceholder,
} from "@/lib/discussions"
import { buildPaginationItems, getPaginationRange } from "@/lib/pagination"
import { useAuth } from "@/lib/hooks/use-auth"
import { PaginationBar } from "@/components/patterns/pagination-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PAGE_SIZE = 12
const COMPOSER_TEXTAREA_CLASS =
  "min-h-[220px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
const STRUCTURED_TEXTAREA_CLASS =
  "min-h-[120px] w-full rounded-[1.2rem] border-[3px] border-border bg-white px-4 py-3 text-sm shadow-[6px_6px_0_hsl(var(--border))] outline-none focus-visible:ring-4 focus-visible:ring-primary/15"

type QuestionDraft = {
  helpMode: DiscussionQuestionHelpMode
  attemptSummary: string
  stuckPoint: string
  errorMessage: string
  extraContext: string
}

function isDiscussionPostType(value: string | null): value is DiscussionPostType {
  return DISCUSSION_POST_TYPE_OPTIONS.some((item) => item.value === value)
}

function isDiscussionPostSort(value: string | null): value is DiscussionPostSort {
  return DISCUSSION_SORT_OPTIONS.some((item) => item.value === value)
}

function resolveInitialPostType(value: string | null, problemId: string, contestId: string) {
  if (isDiscussionPostType(value)) return value
  if (problemId) return "problem_discussion"
  if (contestId) return "contest_discussion"
  return "question"
}

function createEmptyQuestionDraft(): QuestionDraft {
  return {
    helpMode: "hint",
    attemptSummary: "",
    stuckPoint: "",
    errorMessage: "",
    extraContext: "",
  }
}

export function DiscussionHubPage() {
  const searchParams = useSearchParams()

  const { loggedIn } = useAuth()
  const [filters, setFilters] = React.useState({
    keyword: "",
    postType: undefined as DiscussionPostType | undefined,
    problemId: "",
    contestId: "",
    sort: "featured" as DiscussionPostSort,
    page: 1,
  })
  const [pageInput, setPageInput] = React.useState("1")
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [postForm, setPostForm] = React.useState({
    postType: "question" as DiscussionPostType,
    title: "",
    contentMarkdown: "",
    problemId: "",
    contestId: "",
  })
  const [questionDraft, setQuestionDraft] = React.useState<QuestionDraft>(createEmptyQuestionDraft())

  React.useEffect(() => {
    const keyword = searchParams.get("keyword") ?? ""
    const problemId = searchParams.get("problemId") ?? ""
    const contestId = searchParams.get("contestId") ?? ""
    const postType = isDiscussionPostType(searchParams.get("postType"))
      ? (searchParams.get("postType") as DiscussionPostType)
      : undefined
    const sort = isDiscussionPostSort(searchParams.get("sort"))
      ? (searchParams.get("sort") as DiscussionPostSort)
      : postType === "question"
        ? "unsolved"
        : "featured"

    setFilters({
      keyword,
      postType,
      problemId,
      contestId,
      sort,
      page: 1,
    })

    setPostForm((current) => ({
      ...current,
      postType:
        current.title || current.contentMarkdown
          ? current.postType
          : resolveInitialPostType(postType ?? null, problemId, contestId),
      problemId: current.problemId || problemId,
      contestId: current.contestId || contestId,
    }))
  }, [searchParams])

  React.useEffect(() => {
    setPageInput(String(filters.page))
  }, [filters.page])

  const listParams = React.useMemo(() => {
    const params: Record<string, string> = {
      sort: filters.sort,
      page: String(filters.page),
      pageSize: String(PAGE_SIZE),
    }

    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    if (filters.postType) params.postType = filters.postType
    if (filters.problemId.trim()) params.problemId = filters.problemId.trim()
    if (filters.contestId.trim()) params.contestId = filters.contestId.trim()

    return params
  }, [filters])

  const swrKey = React.useMemo(
    () => `/discussions/posts?${new URLSearchParams(listParams).toString()}`,
    [listParams],
  )

  const { data, isLoading, mutate } = useSWR<DiscussionPostListResponse>(swrKey, () =>
    api.discussions.posts.list<DiscussionPostListResponse>(listParams),
  )

  const posts = data?.data ?? []
  const meta = data?.meta ?? {
    total: 0,
    page: filters.page,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  }

  const paginationItems = buildPaginationItems(meta.page, meta.totalPages)
  const paginationRange = getPaginationRange({
    page: meta.page,
    pageSize: meta.pageSize,
    total: meta.total,
    visibleCount: posts.length,
  })

  const createOptions = React.useMemo(
    () => DISCUSSION_POST_TYPE_OPTIONS.filter((item) => item.value !== "announcement"),
    [],
  )

  const composerBinding = React.useMemo(
    () => getDiscussionContextBinding(postForm.postType),
    [postForm.postType],
  )

  const changePostType = React.useCallback((nextType: DiscussionPostType) => {
    setPostForm((current) => ({
      ...current,
      postType: nextType,
      problemId:
        nextType === "contest_discussion" ? "" : current.problemId,
      contestId:
        nextType === "problem_discussion" || nextType === "solution" ? "" : current.contestId,
    }))
  }, [])

  const validateComposer = React.useCallback(() => {
    const title = postForm.title.trim()
    if (title.length < 2) {
      return "标题至少需要 2 个字。"
    }

    if (composerBinding.requiresProblem && !postForm.problemId.trim()) {
      return "当前帖子类型必须绑定题目。"
    }

    if (composerBinding.requiresContest && !postForm.contestId.trim()) {
      return "当前帖子类型必须绑定比赛。"
    }

    if (postForm.postType === "question") {
      if (!questionDraft.attemptSummary.trim()) {
        return "问答帖需要先写清你已经尝试过什么。"
      }

      if (!questionDraft.stuckPoint.trim()) {
        return "问答帖需要写清你具体卡在哪里。"
      }

      return null
    }

    if (!postForm.contentMarkdown.trim()) {
      return "请先填写正文内容。"
    }

    return null
  }, [composerBinding.requiresContest, composerBinding.requiresProblem, postForm, questionDraft.attemptSummary, questionDraft.stuckPoint])

  const submitPost = React.useCallback(async () => {
    if (!loggedIn) {
      setErrorMessage("登录后才能发布讨论")
      return
    }

    const validationMessage = validateComposer()
    if (validationMessage) {
      setErrorMessage(validationMessage)
      setMessage("")
      return
    }

    const contentMarkdown =
      postForm.postType === "question"
        ? buildStructuredQuestionMarkdown({
            helpMode: questionDraft.helpMode,
            attemptSummary: questionDraft.attemptSummary,
            stuckPoint: questionDraft.stuckPoint,
            errorMessage: questionDraft.errorMessage,
            extraContext: questionDraft.extraContext,
          })
        : postForm.contentMarkdown.trim()

    setSubmitting(true)
    setMessage("")
    setErrorMessage("")
    try {
      const response = await api.discussions.posts.create<DiscussionPostDetailResponse>({
        postType: postForm.postType,
        title: postForm.title.trim(),
        contentMarkdown,
        problemId: postForm.problemId.trim() || undefined,
        contestId: postForm.contestId.trim() || undefined,
      })

      if (response.data.auditStatus === "manual_review") {
        setMessage("帖子已提交，正在等待审核通过后公开。")
      } else if (response.data.publishStatus === "delayed_by_contest") {
        setMessage("题解已保存，将在相关比赛结束后自动公开。")
      } else {
        setMessage("帖子发布成功。")
      }

      setPostForm((current) => ({
        ...current,
        title: "",
        contentMarkdown: "",
      }))
      setQuestionDraft(createEmptyQuestionDraft())
      await mutate()
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "发布失败")
    } finally {
      setSubmitting(false)
    }
  }, [loggedIn, mutate, postForm, questionDraft, validateComposer])

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Discussion</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">算法讨论区</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
            这里承接题目讨论、题解沉淀、比赛复盘、算法问答和学习经验分享。题目页与比赛页都可以带着上下文直接跳到这里。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/discuss/legacy">
              <BookOpen className="size-4" />
              旧版学习小组
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/submissions">
              <Flame className="size-4" />
              查看提交
            </Link>
          </Button>
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">筛选讨论</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="搜索标题、摘要或正文"
                  value={filters.keyword}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      keyword: event.target.value,
                      page: 1,
                    }))
                  }
                />
              </div>
              <select
                className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                value={filters.postType ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    postType: (event.target.value || undefined) as DiscussionPostType | undefined,
                    page: 1,
                  }))
                }
              >
                <option value="">全部类型</option>
                {DISCUSSION_POST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                value={filters.sort}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    sort: event.target.value as DiscussionPostSort,
                    page: 1,
                  }))
                }
              >
                {DISCUSSION_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="按题目 ID 过滤"
                value={filters.problemId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    problemId: event.target.value,
                    page: 1,
                  }))
                }
              />
              <Input
                placeholder="按比赛 ID 过滤"
                value={filters.contestId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    contestId: event.target.value,
                    page: 1,
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {filters.problemId ? <Badge variant="secondary">当前题目：{filters.problemId}</Badge> : null}
              {filters.contestId ? <Badge variant="secondary">当前比赛：{filters.contestId}</Badge> : null}
              {!filters.problemId && !filters.contestId ? (
                <span>不绑定上下文时，会展示全站公开讨论。</span>
              ) : (
                <span>你当前看到的是带上下文过滤的讨论流。</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <PenSquare className="size-4 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">发起讨论</h2>
            </div>
            {!loggedIn ? (
              <div className="rounded-[1.3rem] border-[2px] border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                登录后才能发帖、评论、点赞和收藏。
              </div>
            ) : null}
            <div className="rounded-[1.3rem] border-[2px] border-primary/20 bg-primary/10 px-4 py-4 text-sm leading-7 text-foreground">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-primary" />
                发帖规则
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{getDiscussionComposerHint(postForm.postType)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {composerBinding.requiresProblem ? <Badge variant="secondary">必须绑定题目</Badge> : null}
                {composerBinding.requiresContest ? <Badge variant="secondary">必须绑定比赛</Badge> : null}
                {postForm.postType === "question" ? <Badge variant="secondary">结构化提问</Badge> : null}
                {postForm.postType === "solution" ? <Badge variant="secondary">可能延迟公开</Badge> : null}
                {postForm.postType === "contest_discussion" ? <Badge variant="secondary">比赛期更严格审核</Badge> : null}
              </div>
            </div>
            <select
              className="h-11 w-full rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
              value={postForm.postType}
              onChange={(event) => changePostType(event.target.value as DiscussionPostType)}
              disabled={!loggedIn}
            >
              {createOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>
            <Input
              placeholder={getDiscussionTitlePlaceholder(postForm.postType)}
              value={postForm.title}
              onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
              disabled={!loggedIn}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder={composerBinding.requiresProblem ? "题目 ID（必填）" : "题目 ID（选填）"}
                value={postForm.problemId}
                onChange={(event) => setPostForm((current) => ({ ...current, problemId: event.target.value }))}
                disabled={!loggedIn || postForm.postType === "contest_discussion"}
              />
              <Input
                placeholder={composerBinding.requiresContest ? "比赛 ID（必填）" : "比赛 ID（选填）"}
                value={postForm.contestId}
                onChange={(event) => setPostForm((current) => ({ ...current, contestId: event.target.value }))}
                disabled={!loggedIn || postForm.postType === "problem_discussion" || postForm.postType === "solution"}
              />
            </div>
            {postForm.postType === "question" ? (
              <div className="space-y-4 rounded-[1.3rem] border-[2px] border-border/70 bg-card px-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="discussion-help-mode">希望得到哪类帮助</Label>
                    <select
                      id="discussion-help-mode"
                      className="h-11 w-full rounded-[1.2rem] border-[3px] border-border bg-white px-3 text-sm shadow-[6px_6px_0_hsl(var(--border))]"
                      value={questionDraft.helpMode}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({
                          ...current,
                          helpMode: event.target.value as DiscussionQuestionHelpMode,
                        }))
                      }
                      disabled={!loggedIn}
                    >
                      {DISCUSSION_QUESTION_HELP_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} · {option.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-[1.2rem] border-[2px] border-dashed border-border bg-background px-4 py-3 text-xs leading-6 text-muted-foreground">
                    问答帖会自动整理成固定模板，便于别人快速看懂你的背景、尝试过程和卡点。
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discussion-attempt-summary">我已经尝试过什么</Label>
                  <textarea
                    id="discussion-attempt-summary"
                    className={STRUCTURED_TEXTAREA_CLASS}
                    placeholder="写清你已经尝试过的思路、数据结构、写法或调试方向。"
                    value={questionDraft.attemptSummary}
                    onChange={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        attemptSummary: event.target.value,
                      }))
                    }
                    disabled={!loggedIn}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discussion-stuck-point">我具体卡在哪里</Label>
                  <textarea
                    id="discussion-stuck-point"
                    className={STRUCTURED_TEXTAREA_CLASS}
                    placeholder="描述你不确定的边界、错误原因、复杂度瓶颈或具体疑问。"
                    value={questionDraft.stuckPoint}
                    onChange={(event) =>
                      setQuestionDraft((current) => ({
                        ...current,
                        stuckPoint: event.target.value,
                      }))
                    }
                    disabled={!loggedIn}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="discussion-error-message">报错或异常现象（选填）</Label>
                    <textarea
                      id="discussion-error-message"
                      className={STRUCTURED_TEXTAREA_CLASS}
                      placeholder="例如：第 3 组超时、重复元素时多弹一次、答案在大数据下偏小。"
                      value={questionDraft.errorMessage}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({
                          ...current,
                          errorMessage: event.target.value,
                        }))
                      }
                      disabled={!loggedIn}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discussion-extra-context">补充代码片段 / 样例 / 输入输出（选填）</Label>
                    <textarea
                      id="discussion-extra-context"
                      className={STRUCTURED_TEXTAREA_CLASS}
                      placeholder="可以贴最小复现代码片段、关键样例、你自己的分析，不建议直接求完整 AC 代码。"
                      value={questionDraft.extraContext}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({
                          ...current,
                          extraContext: event.target.value,
                        }))
                      }
                      disabled={!loggedIn}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                className={COMPOSER_TEXTAREA_CLASS}
                placeholder={getDiscussionBodyPlaceholder(postForm.postType)}
                value={postForm.contentMarkdown}
                onChange={(event) =>
                  setPostForm((current) => ({
                    ...current,
                    contentMarkdown: event.target.value,
                  }))
                }
                disabled={!loggedIn}
              />
            )}
            <Button onClick={submitPost} disabled={!loggedIn || submitting}>
              <MessageSquare className="size-4" />
              {submitting ? "发布中..." : "发布讨论"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-foreground">公开讨论列表</div>
            <div className="text-sm text-muted-foreground">
              当前共 {meta.total} 帖，按“{DISCUSSION_SORT_OPTIONS.find((item) => item.value === filters.sort)?.label ?? filters.sort}”
              排序。
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            第 {meta.page} / {meta.totalPages} 页
          </Badge>
        </div>

        {isLoading ? (
          <Card className="bg-background">
            <CardContent className="px-6 py-8 text-sm text-muted-foreground">讨论列表加载中...</CardContent>
          </Card>
        ) : null}

        {!isLoading && posts.length === 0 ? (
          <Card className="bg-background">
            <CardContent className="px-6 py-8 text-sm text-muted-foreground">
              还没有符合当前筛选条件的公开讨论。你可以直接发起第一条。
            </CardContent>
          </Card>
        ) : null}

        {posts.map((post) => (
          <Card key={post.id} className="bg-background">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={getDiscussionPostTypeTone(post.postType)}>
                      {getDiscussionPostTypeLabel(post.postType)}
                    </Badge>
                    {post.isPinned ? <Badge variant="secondary">置顶</Badge> : null}
                    {post.isFeatured ? <Badge variant="secondary">精选</Badge> : null}
                    {post.isRecommended ? <Badge variant="secondary">推荐</Badge> : null}
                    {post.postType === "question" && post.isSolved ? <Badge variant="secondary">已解决</Badge> : null}
                  </div>
                  <div>
                    <Link
                      href={`/discuss/topics/${post.id}`}
                      className="text-2xl font-semibold tracking-tight text-foreground hover:text-primary"
                    >
                      {post.title}
                    </Link>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                      {post.excerpt || "这条帖子还没有生成摘要。"}
                    </p>
                  </div>
                </div>
                <Button asChild variant="secondary">
                  <Link href={`/discuss/topics/${post.id}`}>查看详情</Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.tagName}
                  </Badge>
                ))}
                {post.problemId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/problems/${post.problemId}`}>关联题目</Link>
                  </Button>
                ) : null}
                {post.contestId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/contests/${post.contestId}`}>关联比赛</Link>
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span>{post.author.name || "匿名同学"}</span>
                <span>{formatDiscussionDateTime(post.createdAt)}</span>
                <span>评论 {post.commentCount}</span>
                <span>回复 {post.replyCount}</span>
                <span>点赞 {post.likeCount}</span>
                <span>收藏 {post.favoriteCount}</span>
                <span>热度 {post.hotScore.toFixed(1)}</span>
              </div>
            </CardContent>
          </Card>
        ))}

        <PaginationBar
          range={paginationRange}
          currentPage={meta.page}
          totalPages={meta.totalPages}
          items={paginationItems}
          loading={isLoading}
          pageNoun="条帖子"
          pageInput={pageInput}
          canJumpToPage={Boolean(pageInput) && Number(pageInput) >= 1 && Number(pageInput) <= meta.totalPages}
          onPageInputChange={setPageInput}
          onPageInputSubmit={() => {
            const nextPage = Number(pageInput)
            if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > meta.totalPages) return
            setFilters((current) => ({ ...current, page: nextPage }))
          }}
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      </div>
    </div>
  )
}
