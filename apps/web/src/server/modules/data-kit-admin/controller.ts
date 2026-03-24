import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { jsonData } from "@/lib/api-response"
import {
  getDataKitOverview,
  generateWithDataKit,
  runDataKitSelfTest,
  validateWithDataKit,
} from "@/server/modules/data-kit-admin/service"
import { DataKitGenerateSchema, DataKitValidateSchema } from "@/server/modules/data-kit-admin/schemas"
import { DataKitError } from "@/server/modules/data-kit-admin/shared"

function mapErrorToResponse(error: unknown) {
  if (error instanceof DataKitError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.status },
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: "请求参数不合法",
        issues: error.flatten(),
      },
      { status: 400 },
    )
  }

  console.error("[data-kit-admin]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "数据模板工具箱暂时不可用，请稍后再试。",
    },
    { status: 500 },
  )
}

export async function handleGetDataKitOverview() {
  try {
    return jsonData(await getDataKitOverview())
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleGenerateWithDataKit(req: NextRequest) {
  try {
    const body = DataKitGenerateSchema.parse(await req.json())
    return jsonData(await generateWithDataKit(body.tool, body.params))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleValidateWithDataKit(req: NextRequest) {
  try {
    const body = DataKitValidateSchema.parse(await req.json())
    return jsonData(await validateWithDataKit(body.tool, body.params, body.input))
  } catch (error) {
    return mapErrorToResponse(error)
  }
}

export async function handleRunDataKitSelfTest() {
  try {
    return jsonData(await runDataKitSelfTest())
  } catch (error) {
    return mapErrorToResponse(error)
  }
}
