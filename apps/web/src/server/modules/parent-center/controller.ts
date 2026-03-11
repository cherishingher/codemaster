import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import type { AuthUser } from "@/lib/authz"
import {
  createParentBinding,
  getParentLearningOverview,
  listParentChildren,
  removeParentBinding,
} from "@/server/modules/parent-center/service"

const ParentOverviewQuerySchema = z.object({
  studentId: z.string().trim().min(1).max(64).optional(),
})

const CreateParentBindingSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(32).optional(),
  note: z.string().trim().max(200).optional(),
})

function mapParentError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: "请求参数不合法",
        issues: error.flatten(),
      },
      { status: 400 },
    )
  }

  if (error instanceof Error && error.message === "unauthorized") {
    return NextResponse.json({ error: "unauthorized", message: "请先登录后查看家长报告" }, { status: 401 })
  }

  if (error instanceof Error && error.message === "student_not_found") {
    return NextResponse.json({ error: "student_not_found", message: "未找到对应学生账号" }, { status: 404 })
  }

  if (error instanceof Error && error.message === "binding_not_found") {
    return NextResponse.json({ error: "binding_not_found", message: "家长绑定关系不存在" }, { status: 404 })
  }

  if (error instanceof Error && error.message === "self_binding_not_allowed") {
    return NextResponse.json(
      { error: "self_binding_not_allowed", message: "家长账号不能绑定自己为学生" },
      { status: 400 },
    )
  }

  if (error instanceof Error && error.message === "invalid_identifier") {
    return NextResponse.json({ error: "invalid_identifier", message: "请输入学生邮箱或手机号" }, { status: 400 })
  }

  console.error("[parent-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "家长报告暂时不可用，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleListParentChildren(user: AuthUser) {
  try {
    const payload = await listParentChildren(user)
    return NextResponse.json(payload)
  } catch (error) {
    return mapParentError(error)
  }
}

export async function handleGetParentOverview(req: NextRequest, user: AuthUser) {
  try {
    const { searchParams } = new URL(req.url)
    const query = ParentOverviewQuerySchema.parse({
      studentId: searchParams.get("studentId") ?? undefined,
    })
    const payload = await getParentLearningOverview(user, query.studentId)
    return NextResponse.json({ data: payload })
  } catch (error) {
    return mapParentError(error)
  }
}

export async function handleCreateParentBinding(req: NextRequest, user: AuthUser) {
  try {
    const payload = CreateParentBindingSchema.parse(await req.json())
    const result = await createParentBinding(user, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return mapParentError(error)
  }
}

export async function handleRemoveParentBinding(relationId: string, user: AuthUser) {
  try {
    await removeParentBinding(user, relationId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapParentError(error)
  }
}
