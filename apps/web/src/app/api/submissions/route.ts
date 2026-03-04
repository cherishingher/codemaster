import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { getSubmissionErrorMessage, mapSubmissionStatusToUi } from "@/lib/oj";

function parseIntParam(value: string | null, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}${endOfDay ? "T23:59:59.999" : "T00:00:00.000"}`
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export const GET = withAuth(async (req, _ctx, user) => {
  const { searchParams } = new URL(req.url);
  const page = parseIntParam(searchParams.get("page"), 1);
  const limit = parseIntParam(searchParams.get("limit"), 20, 100);
  const rawStatus = searchParams.get("status")?.trim();
  const rawLanguage = searchParams.get("language")?.trim();
  const problemId = searchParams.get("problemId")?.trim();
  const problemSlug = searchParams.get("problemSlug")?.trim();
  const dateFrom =
    parseDateParam(searchParams.get("dateFrom")) ??
    parseDateParam(searchParams.get("from"));
  const dateTo =
    parseDateParam(searchParams.get("dateTo"), true) ??
    parseDateParam(searchParams.get("to"), true);
  const requestedUserId = searchParams.get("userId")?.trim();

  let resolvedProblemId = problemId;
  if (!resolvedProblemId && problemSlug) {
    const problem = await db.problem.findUnique({
      where: { slug: problemSlug },
      select: { id: true },
    });
    resolvedProblemId = problem?.id;
  }

  if (problemSlug && !resolvedProblemId) {
    return NextResponse.json({
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    });
  }

  const where: Prisma.SubmissionWhereInput = {
    userId: user.roles.includes("admin") && requestedUserId ? requestedUserId : user.id,
  };

  if (rawStatus) {
    where.status = rawStatus;
  }
  if (rawLanguage) {
    where.lang = {
      equals: rawLanguage,
      mode: "insensitive",
    };
  }
  if (resolvedProblemId) {
    where.problemId = resolvedProblemId;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const [total, submissions] = await Promise.all([
    db.submission.count({ where }),
    db.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },
        compileInfo: {
          select: {
            exitCode: true,
            message: true,
          },
        },
        runtimeInfo: {
          select: {
            exitCode: true,
            checkerMessage: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: submissions.map((submission) => ({
      id: submission.id,
      status: mapSubmissionStatusToUi(submission.status),
      rawStatus: submission.status,
      judgeResult: submission.judgeResult,
      score: submission.score,
      language: submission.lang,
      languageId: submission.languageId,
      judgeBackend: submission.judgeBackend,
      timeUsedMs: submission.timeUsedMs,
      memoryUsedKb: submission.memoryUsedKb,
      createdAt: submission.createdAt,
      finishedAt: submission.finishedAt,
      problem: submission.problem,
      compileInfo: submission.compileInfo,
      runtimeInfo: submission.runtimeInfo,
      errorMessage: getSubmissionErrorMessage(submission),
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  });
});
