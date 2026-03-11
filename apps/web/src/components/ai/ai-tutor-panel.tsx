"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Bot, Loader2, MessageSquareText, Sparkles } from "lucide-react"
import { api } from "@/lib/api-client"
import type { AiTutorResponse } from "@/lib/ai"
import { ProblemRichText } from "@/components/problems/problem-markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const GENERAL_QUESTIONS = [
  "帮我拆解这道题的思路，但不要直接给完整代码",
  "这题最容易错的边界条件有哪些",
  "结合我最近的弱项，应该先练什么",
]

export function AiTutorPanel({
  problemId,
  problemTitle,
  compact = false,
}: {
  problemId?: string
  problemTitle?: string | null
  compact?: boolean
}) {
  const [question, setQuestion] = React.useState(
    problemTitle ? `帮我拆解《${problemTitle}》这道题的思路，但不要直接给完整代码` : "",
  )
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<AiTutorResponse["data"] | null>(null)

  React.useEffect(() => {
    if (!problemTitle) return
    setQuestion((current) =>
      current.trim()
        ? current
        : `帮我拆解《${problemTitle}》这道题的思路，但不要直接给完整代码`,
    )
  }, [problemTitle])

  const handleAsk = React.useCallback(async () => {
    const value = question.trim()
    if (!value) {
      toast.error("请先输入问题")
      return
    }

    setLoading(true)
    try {
      const response = await api.ai.tutor<AiTutorResponse>({
        question: value,
        problemId,
      })
      setData(response.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 问答失败")
    } finally {
      setLoading(false)
    }
  }, [problemId, question])

  return (
    <Card className="bg-background">
      <CardContent className={compact ? "space-y-4 p-5" : "space-y-5 p-6 md:p-7"}>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Bot className="size-3.5" />
            AI Tutor
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            {problemId ? "AI 题目辅导" : "AI 算法答疑"}
          </h3>
          <p className="text-sm leading-7 text-muted-foreground">
            {problemId
              ? "围绕当前题目给你思路拆解、排错建议和下一步提示，默认不直接给完整标准代码。"
              : "你可以直接问算法、做题方法或学习节奏问题，系统会结合最近训练情况给出建议。"}
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            rows={compact ? 4 : 5}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={problemId ? "例如：这题为什么更适合用 BFS 而不是 DFS？" : "例如：动态规划总是不会定义状态，怎么办？"}
            className="w-full rounded-[1.2rem] border-[2px] border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/50"
          />
          <div className="flex flex-wrap gap-2">
            {GENERAL_QUESTIONS.map((item) => (
              <Button key={item} type="button" variant="secondary" onClick={() => setQuestion(item)}>
                {item}
              </Button>
            ))}
          </div>
          <Button type="button" onClick={() => void handleAsk()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
            提交问题
          </Button>
        </div>

        {data ? (
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{data.mode === "llm" ? "LLM 增强" : "规则引擎"}</Badge>
                {data.context.problemTitle ? <Badge variant="outline">{data.context.problemTitle}</Badge> : null}
              </div>
              <ProblemRichText content={data.answer} mode="markdown" />
            </div>

            {data.followUps.length > 0 ? (
              <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                <h4 className="text-lg font-semibold text-foreground">继续追问</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.followUps.map((item) => (
                    <Button key={item} type="button" variant="secondary" onClick={() => setQuestion(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {data.relatedResources.length > 0 ? (
              <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="text-lg font-semibold text-foreground">相关学习资源</h4>
                </div>
                <div className="space-y-3">
                  {data.relatedResources.map((item) => (
                    <div key={`${item.resourceType}:${item.id}`} className="rounded-[1rem] border border-border/70 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.resourceType}</Badge>
                            {item.locked ? <Badge variant="outline">{item.requiredSources.join(" / ")}</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1 text-sm leading-7 text-muted-foreground">{item.reason}</p>
                        </div>
                        <Button asChild variant={item.locked ? "secondary" : "outline"} size="sm">
                          <Link href={item.locked ? "/products" : item.href}>
                            {item.locked ? "查看解锁" : "打开"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
