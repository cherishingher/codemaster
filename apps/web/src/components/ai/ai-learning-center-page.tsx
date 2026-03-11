"use client"

import { BrainCircuit, CalendarRange, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { AiLearningPlanCard } from "@/components/ai/ai-learning-plan-card"
import { AiRecommendationsCard } from "@/components/ai/ai-recommendations-card"
import { AiTutorPanel } from "@/components/ai/ai-tutor-panel"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AiLearningCenterPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })

  if (loading || !user) {
    return <div className="page-wrap py-10 text-sm text-muted-foreground">AI 辅导台加载中...</div>
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="space-y-6">
        <Card className="bg-background">
          <CardContent className="space-y-4 p-7 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BrainCircuit className="size-3.5" />
              AI Learning Copilot
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                AI 智能辅导台
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                基于现有学习报告、训练路径、题解和做题记录，为你提供智能推荐、实时答疑和个性化学习规划。
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="recommendations">
              <Sparkles className="mr-2 size-4" />
              智能推荐
            </TabsTrigger>
            <TabsTrigger value="plan">
              <CalendarRange className="mr-2 size-4" />
              学习规划
            </TabsTrigger>
            <TabsTrigger value="tutor">
              <BrainCircuit className="mr-2 size-4" />
              AI 问答
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations">
            <AiRecommendationsCard />
          </TabsContent>

          <TabsContent value="plan">
            <AiLearningPlanCard />
          </TabsContent>

          <TabsContent value="tutor">
            <AiTutorPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
