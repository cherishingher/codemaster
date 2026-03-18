import { NextResponse, type NextRequest } from "next/server"
import { Prisma, type GenerationLogLevel, type TestdataGenerationTaskStage } from "@prisma/client"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"

function parsePagination(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "100", 10) || 100))
  return { page, pageSize }
}

export const GET = withAuth(async (req, { params }) => {
  const task = await db.testdataGenerationTask.findUnique({
    where: { id: params.taskId },
    select: { id: true },
  })
  if (!task) {
    return NextResponse.json({ error: "task_not_found" }, { status: 404 })
  }

  const { page, pageSize } = parsePagination(req)
  const level = req.nextUrl.searchParams.get("level") || undefined
  const stage = req.nextUrl.searchParams.get("stage") || undefined
  const where: Prisma.TestdataGenerationLogWhereInput = {
    taskId: params.taskId,
    ...(level ? { level: level as GenerationLogLevel } : {}),
    ...(stage ? { stage: stage as TestdataGenerationTaskStage } : {}),
  }

  const [items, total] = await Promise.all([
    db.testdataGenerationLog.findMany({
      where,
      orderBy: { sequenceNo: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        stdoutAsset: {
          select: { id: true, uri: true, fileName: true },
        },
        stderrAsset: {
          select: { id: true, uri: true, fileName: true },
        },
      },
    }),
    db.testdataGenerationLog.count({ where }),
  ])

  return NextResponse.json({
    items: items.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      caseId: log.caseId,
      sequenceNo: log.sequenceNo,
      level: log.level,
      stage: log.stage,
      code: log.code,
      message: log.message,
      detail: log.detail,
      stdoutAsset: log.stdoutAsset,
      stderrAsset: log.stderrAsset,
      workerId: log.workerId,
      createdAt: log.createdAt,
    })),
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
  })
}, { roles: "admin" })
