import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { AuthUser } from "@/lib/authz"
import { getContestRegistrationStatus } from "@/server/modules/contest-center/registration.service"
import { ContestIdParamSchema, ContestListQuerySchema, ContestRankingQuerySchema } from "@/server/modules/contest-center/schemas"
import { ContestCenterError } from "@/server/modules/contest-center/shared"
import {
  createContestRegistrationOrder,
  getContestAnalysis,
  getContestDetail,
  getContestRanking,
  getContestReport,
  listContests,
} from "@/server/modules/contest-center/service"

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries())
}

function mapContestError(error: unknown) {
  if (error instanceof ContestCenterError) {
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
        message: "模拟赛数据重复，请检查唯一约束",
      },
      { status: 409 },
    )
  }

  console.error("[contest-center]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "模拟赛服务暂时不可用，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleListContests(req: NextRequest, user?: AuthUser | null) {
  try {
    const { searchParams } = new URL(req.url)
    const query = ContestListQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await listContests(query, user ?? undefined)

    return NextResponse.json({
      data: payload.items,
      meta: {
        total: payload.total,
        q: payload.q,
      },
    })
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleGetContest(id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const detail = await getContestDetail(resolvedId, user ?? undefined)

    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "模拟赛不存在" }, { status: 404 })
    }

    return NextResponse.json({ data: detail })
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleGetContestRegistration(id: string, user: AuthUser) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const detail = await getContestDetail(resolvedId, user)
    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "模拟赛不存在" }, { status: 404 })
    }

    const registration = await getContestRegistrationStatus(user.id, detail.id)
    return NextResponse.json({ data: registration })
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleCreateContestRegistration(id: string, user: AuthUser) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const payload = await createContestRegistrationOrder(resolvedId, { id: user.id })
    return NextResponse.json(payload, { status: 201 })
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleGetContestRankings(req: NextRequest, id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const detail = await getContestDetail(resolvedId, user ?? undefined)
    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "模拟赛不存在" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const query = ContestRankingQuerySchema.parse(searchParamsToObject(searchParams))
    const payload = await getContestRanking(detail.id, user?.id ?? null, query.limit)
    return NextResponse.json(payload)
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleGetContestAnalysis(id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const payload = await getContestAnalysis(resolvedId, user ?? undefined)
    if (!payload) {
      return NextResponse.json({ error: "not_found", message: "模拟赛不存在" }, { status: 404 })
    }
    return NextResponse.json({ data: payload })
  } catch (error) {
    return mapContestError(error)
  }
}

export async function handleGetContestReport(id: string, user?: AuthUser | null) {
  try {
    const { id: resolvedId } = ContestIdParamSchema.parse({ id })
    const payload = await getContestReport(resolvedId, user ?? undefined)
    if (!payload) {
      return NextResponse.json({ error: "not_found", message: "模拟赛不存在" }, { status: 404 })
    }
    return NextResponse.json({ data: payload })
  } catch (error) {
    return mapContestError(error)
  }
}
