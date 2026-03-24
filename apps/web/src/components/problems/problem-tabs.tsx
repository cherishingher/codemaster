import * as React from "react"
import Link from "next/link"
import { MessageSquareText, Sparkles } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

type ProblemTabValue = "statement" | "discussion" | "tips"

type ProblemTabsProps = {
  value: ProblemTabValue
  onValueChange: (value: ProblemTabValue) => void
  questionHref: string
  discussionHref: string
}

const tabDescriptions: Record<ProblemTabValue, string> = {
  statement: "先阅读题意、输入输出、样例和限制，再进入代码区。",
  discussion: "围绕该题的思路交流、结构化求助与赛后复盘。",
  tips: "集中放提示、题解与 AI 辅导，不和正文混在一起。",
}

export function ProblemTabs({
  value,
  onValueChange,
  questionHref,
  discussionHref,
}: ProblemTabsProps) {
  return (
    <div className="space-y-3">
      <Tabs value={value} onValueChange={(next) => onValueChange(next as ProblemTabValue)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="statement">题面</TabsTrigger>
            <TabsTrigger value="discussion">讨论</TabsTrigger>
            <TabsTrigger value="tips">提示</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={questionHref}>
                <MessageSquareText className="size-4" />
                发布求助帖
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={discussionHref}>
                <Sparkles className="size-4" />
                查看题目讨论
              </Link>
            </Button>
          </div>
        </div>
      </Tabs>
      <div className="rounded-[1.2rem] border-[2px] border-border bg-background/90 px-4 py-3 text-sm text-muted-foreground">
        {tabDescriptions[value]}
      </div>
    </div>
  )
}
