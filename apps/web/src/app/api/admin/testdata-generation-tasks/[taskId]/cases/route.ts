import { NextResponse, type NextRequest } from "next/server"
import { Prisma, type TestdataCaseStatus } from "@prisma/client"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"

function parsePagination(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "50", 10) || 50))
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
  const status = req.nextUrl.searchParams.get("status") || undefined
  const where: Prisma.TestdataCaseWhereInput = {
    taskId: params.taskId,
    ...(status ? { status: status as TestdataCaseStatus } : {}),
  }

  const [items, total] = await Promise.all([
    db.testdataCase.findMany({
      where,
      orderBy: { ordinal: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inputAsset: {
          select: { id: true, uri: true, fileName: true },
        },
        expectedOutputAsset: {
          select: { id: true, uri: true, fileName: true },
        },
        runtimeStderrAsset: {
          select: { id: true, uri: true, fileName: true },
        },
      },
    }),
    db.testdataCase.count({ where }),
  ])

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      ordinal: item.ordinal,
      groupKey: item.groupKey,
      title: item.title,
      score: item.score,
      isSample: item.isSample,
      isPretest: item.isPretest,
      visible: item.visible,
      caseType: item.caseType,
      subtaskId: item.subtaskId,
      groupId: item.groupId,
      orderIndex: item.orderIndex,
      status: item.status,
      executionStatus: item.executionStatus,
      executionDurationMs: item.executionDurationMs,
      executionMemoryKb: item.executionMemoryKb,
      exitCode: item.exitCode,
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      inputAsset: item.inputAsset,
      expectedOutputAsset: item.expectedOutputAsset,
      runtimeStderrAsset: item.runtimeStderrAsset,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
  })
}, { roles: "admin" })
