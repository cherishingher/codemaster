import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"

export const GET = withAuth(async (_req, { params }) => {
  const task = await db.testdataGenerationTask.findUnique({
    where: { id: params.taskId },
    include: {
      standardSolution: {
        select: {
          id: true,
          label: true,
          language: true,
          isPrimary: true,
        },
      },
      compileStdoutAsset: {
        select: { id: true, uri: true, fileName: true },
      },
      compileStderrAsset: {
        select: { id: true, uri: true, fileName: true },
      },
      packageAsset: {
        select: { id: true, uri: true, fileName: true },
      },
    },
  })

  if (!task) {
    return NextResponse.json({ error: "task_not_found" }, { status: 404 })
  }

  return NextResponse.json({
    id: task.id,
    problemId: task.problemId,
    problemVersionId: task.problemVersionId,
    standardSolution: task.standardSolution,
    status: task.status,
    stage: task.stage,
    mode: task.mode,
    queueName: task.queueName,
    workerId: task.workerId,
    seed: task.seed,
    attemptNo: task.attemptNo,
    retriedFromTaskId: task.retriedFromTaskId,
    plannedCaseCount: task.plannedCaseCount,
    generatedCaseCount: task.generatedCaseCount,
    succeededCaseCount: task.succeededCaseCount,
    failedCaseCount: task.failedCaseCount,
    persistedCaseCount: task.persistedCaseCount,
    replacedTestcaseCount: task.replacedTestcaseCount,
    compileExitCode: task.compileExitCode,
    compileDurationMs: task.compileDurationMs,
    compileStdoutAsset: task.compileStdoutAsset,
    compileStderrAsset: task.compileStderrAsset,
    packageAsset: task.packageAsset,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    resultSummary: task.resultSummary,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  })
}, { roles: "admin" })
