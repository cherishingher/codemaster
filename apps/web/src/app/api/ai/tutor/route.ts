import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { getAuthUser } from "@/lib/authz"
import { answerAiTutorQuestion } from "@/server/modules/ai-center/service"
import { AiTutorSchema } from "@/server/modules/ai-center/schemas"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录后使用 AI 辅导",
      },
      { status: 401 },
    )
  }

  try {
    const input = AiTutorSchema.parse(await req.json().catch(() => ({})))
    const data = await answerAiTutorQuestion(user, input)
    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "invalid_payload",
          message: "AI 问答请求参数不合法",
          issues: error.flatten(),
        },
        { status: 400 },
      )
    }

    console.error("[ai/tutor]", error)
    return NextResponse.json(
      {
        error: "internal_error",
        message: "AI 辅导暂时不可用，请稍后再试",
      },
      { status: 500 },
    )
  }
}

