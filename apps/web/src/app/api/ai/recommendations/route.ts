import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { getAuthUser } from "@/lib/authz"
import { getAiRecommendations } from "@/server/modules/ai-center/service"
import { AiRecommendationsQuerySchema } from "@/server/modules/ai-center/schemas"

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后查看 AI 推荐",
      },
      { status: 401 },
    )
  }

  try {
    const query = AiRecommendationsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    )
    const data = await getAiRecommendations(user, query)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "invalid_query",
          message: "推荐请求参数不合法",
          issues: error.flatten(),
        },
        { status: 400 },
      )
    }

    console.error("[ai/recommendations]", error)
    return NextResponse.json(
      {
        error: "internal_error",
        message: "AI 推荐生成失败，请稍后再试",
      },
      { status: 500 },
    )
  }
}

