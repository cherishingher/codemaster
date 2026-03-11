import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { AuthUser } from "@/lib/authz"
import {
  getCampClassDetail,
  getCampDetail,
  getCampGraduationReportPayload,
  getCampRankingPayload,
  getCampTasksPayload,
  listCamps,
  resolveCampId,
  resolveDefaultCampClassId,
} from "@/server/modules/camp-center/camp.service"
import { submitCampCheckin } from "@/server/modules/camp-center/checkin.service"
import { getCampEnrollmentStatus } from "@/server/modules/camp-center/enrollment.service"
import {
  CampCheckinSchema,
  CampIdParamSchema,
  CampListQuerySchema,
  CampScopedClassQuerySchema,
} from "@/server/modules/camp-center/schemas"
import { CampCenterError } from "@/server/modules/camp-center/shared"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

function mapCampCenterError(error: unknown) {
  if (error instanceof CampCenterError) {
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

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json(
      {
        error: "conflict",
        message: "训练营数据重复，请检查唯一约束",
      },
      { status: 409 },
    )
  }

  console.error("[camp-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "训练营服务暂时不可用，请稍后再试",
    },
    { status: 500 },
  )
}

async function resolveClassId(campId: string, req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = CampScopedClassQuerySchema.parse(searchParamsToObject(searchParams))
  const resolvedCampId = await resolveCampId(campId)
  return {
    campId: resolvedCampId,
    classId: query.classId ?? (resolvedCampId ? await resolveDefaultCampClassId(resolvedCampId) : null),
    limit: query.limit,
  }
}

export async function handleListCamps(req: NextRequest, user?: AuthUser | null) {
  try {
    const { searchParams } = new URL(req.url)
    const query = CampListQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await listCamps(query, user ?? undefined)

    return NextResponse.json({
      data: payload.items,
      meta: {
        total: payload.total,
        q: payload.q,
      },
    })
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCamp(id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const detail = await getCampDetail(resolvedId, user ?? undefined)

    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "训练营不存在" }, { status: 404 })
    }

    return NextResponse.json({ data: detail })
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCampEnrollment(id: string, user: AuthUser) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const campId = await resolveCampId(resolvedId)
    if (!campId) {
      return NextResponse.json({ error: "not_found", message: "训练营不存在" }, { status: 404 })
    }
    const detail = await getCampEnrollmentStatus(user.id, campId)
    return NextResponse.json({ data: detail })
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCampTasks(req: NextRequest, id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const { campId, classId } = await resolveClassId(resolvedId, req)

    if (!campId || !classId) {
      return NextResponse.json({ error: "not_found", message: "训练营班级不存在" }, { status: 404 })
    }

    const payload = await getCampTasksPayload(campId, classId, user ?? undefined)
    return NextResponse.json(payload)
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleCreateCampCheckin(req: NextRequest, id: string, user: AuthUser) {
  try {
    CampIdParamSchema.parse({ id })
    const payload = CampCheckinSchema.parse(await req.json())

    const result = await submitCampCheckin(user.id, payload.classId, payload.taskId, payload.note)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCampRankings(req: NextRequest, id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const { campId, classId, limit } = await resolveClassId(resolvedId, req)

    if (!campId || !classId) {
      return NextResponse.json({ error: "not_found", message: "训练营班级不存在" }, { status: 404 })
    }

    const payload = await getCampRankingPayload(campId, classId, user ?? undefined, limit)
    return NextResponse.json(payload)
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCampGraduationReport(req: NextRequest, id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const { campId, classId } = await resolveClassId(resolvedId, req)

    if (!campId || !classId) {
      return NextResponse.json({ error: "not_found", message: "训练营班级不存在" }, { status: 404 })
    }

    const payload = await getCampGraduationReportPayload(campId, classId, user ?? undefined)
    return NextResponse.json(payload)
  } catch (error) {
    return mapCampCenterError(error)
  }
}

export async function handleGetCampClassDetail(id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = CampIdParamSchema.parse({ id })
    const detail = await getCampClassDetail(resolvedId, user ?? undefined)

    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "训练营班级不存在" }, { status: 404 })
    }

    return NextResponse.json({ data: detail })
  } catch (error) {
    return mapCampCenterError(error)
  }
}
