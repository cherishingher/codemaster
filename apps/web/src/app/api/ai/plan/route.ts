import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { getAuthUser } from "@/lib/authz"
import { generateAiLearningPlan } from "@/server/modules/ai-center/service"
import { AiLearningPlanSchema } from "@/server/modules/ai-center/schemas"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后生成学习计划",
      },
      { status: 401 },
    )
  }

  try {
    const input = AiLearningPlanSchema.parse(await req.json().catch(() => ({})))
    const data = await generateAiLearningPlan(user, input)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "invalid_payload",
          message: "学习计划请求参数不合法",
          issues: error.flatten(),
        },
        { status: 400 },
      )
    }

    console.error("[ai/plan]", error)
    return NextResponse.json(
      {
        error: "internal_error",
        message: "AI 学习计划生成失败，请稍后再试",
      },
      { status: 500 },
    )
  }
}

