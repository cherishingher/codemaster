import { db } from "@/lib/db";
import {
  deriveUserProblemStatus,
  isFinalJudgeStatus,
  toSubmissionJudgeResult,
} from "@/lib/oj";

export function mapJudgeStatus(code: number) {
  switch (code) {
    case 0:
    case 1:
      return "QUEUED";
    case 2:
    case 3:
    case 12:
    case 13:
      return "RUNNING";
    case 4:
      return "AC";
    case 5:
      return "PE";
    case 6:
      return "WA";
    case 7:
      return "TLE";
    case 8:
      return "MLE";
    case 9:
      return "OLE";
    case 10:
      return "RE";
    case 11:
      return "CE";
    default:
      return "UNKNOWN";
  }
}

export async function applyJudgeResult(args: {
  submissionId: string;
  status: string;
  score: number;
  maxTimeMs?: number;
  maxMemoryMb?: number;
  compileMessage?: string | null;
  runtimeMessage?: string | null;
  cases?: {
    testcaseId?: string | null;
    status: string;
    timeMs: number;
    memoryMb: number;
    score: number;
  }[];
}) {
  const submission = await db.submission.findUnique({
    where: { id: args.submissionId },
    select: {
      id: true,
      userId: true,
      problemId: true,
      status: true,
      finishedAt: true,
    },
  });
  if (!submission) return;

  const accepted = args.status.toUpperCase() === "AC" || args.status.toUpperCase() === "ACCEPTED";
  const nextIsFinal = isFinalJudgeStatus(args.status);
  const wasFinal = submission.finishedAt !== null || isFinalJudgeStatus(submission.status);
  const maxTimeMs =
    args.maxTimeMs ??
    (args.cases?.length ? Math.max(...args.cases.map((item) => item.timeMs)) : 0);
  const maxMemoryKb =
    args.maxMemoryMb ??
    (args.cases?.length ? Math.max(...args.cases.map((item) => item.memoryMb)) : 0);

  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: args.submissionId },
      data: {
        status: args.status,
        judgeResult: toSubmissionJudgeResult(args.status),
        score: args.score,
        timeUsedMs: maxTimeMs,
        memoryUsedKb: maxMemoryKb,
        finishedAt: nextIsFinal ? submission.finishedAt ?? new Date() : submission.finishedAt,
      },
    });

    if (args.compileMessage) {
      await tx.compileInfo.upsert({
        where: { submissionId: args.submissionId },
        update: {
          message: args.compileMessage,
        },
        create: {
          submissionId: args.submissionId,
          message: args.compileMessage,
        },
      });
    }

    if (args.runtimeMessage) {
      await tx.runtimeInfo.upsert({
        where: { submissionId: args.submissionId },
        update: {
          stderrPreview: args.runtimeMessage,
          checkerMessage: args.status,
        },
        create: {
          submissionId: args.submissionId,
          stderrPreview: args.runtimeMessage,
          checkerMessage: args.status,
        },
      });
    }

    if (args.cases?.length) {
      await tx.submissionCase.deleteMany({
        where: { submissionId: args.submissionId },
      });
      await tx.submissionCase.createMany({
        data: args.cases.map((item, index) => ({
          submissionId: args.submissionId,
          testcaseId: item.testcaseId ?? null,
          ordinal: index + 1,
          status: item.status,
          judgeResult: toSubmissionJudgeResult(item.status),
          timeMs: item.timeMs,
          memoryMb: item.memoryMb,
          score: item.score,
        })),
        skipDuplicates: true,
      });
    }

    if (wasFinal || !nextIsFinal) {
      return;
    }

    const stat = await tx.problemStat.findUnique({
      where: { problemId: submission.problemId },
    });

    const total = stat?.totalSubmissions ?? 0;
    const acceptedCount = stat?.acceptedSubmissions ?? 0;
    const newTotal = total + 1;
    const newAccepted = acceptedCount + (accepted ? 1 : 0);
    const newAvgTimeMs = Math.round(
      ((stat?.avgTimeMs ?? 0) * total + maxTimeMs) / newTotal
    );
    const newAvgMemoryMb = Math.round(
      ((stat?.avgMemoryMb ?? 0) * total + maxMemoryKb) / newTotal
    );
    const passRate = newTotal > 0 ? newAccepted / newTotal : 0;

    if (stat) {
      await tx.problemStat.update({
        where: { problemId: submission.problemId },
        data: {
          totalSubmissions: newTotal,
          acceptedSubmissions: newAccepted,
          passRate,
          avgTimeMs: newAvgTimeMs,
          avgMemoryMb: newAvgMemoryMb,
          updatedAt: new Date(),
        },
      });
    } else {
      await tx.problemStat.create({
        data: {
          problemId: submission.problemId,
          totalSubmissions: 1,
          acceptedSubmissions: accepted ? 1 : 0,
          passRate: accepted ? 1 : 0,
          avgTimeMs: maxTimeMs,
          avgMemoryMb: maxMemoryKb,
        },
      });
    }

    await tx.problem.update({
      where: { id: submission.problemId },
      data: {
        totalSubmissions: { increment: 1 },
        acceptedSubmissions: accepted ? { increment: 1 } : undefined,
        passRate,
      },
    });

    const existingProgress = await tx.userProblemProgress.findUnique({
      where: {
        userId_problemId: {
          userId: submission.userId,
          problemId: submission.problemId,
        },
      },
    });

    const nextStatus = deriveUserProblemStatus({
      attempts: (existingProgress?.attempts ?? 0) + 1,
      solvedAt: existingProgress?.solvedAt ?? (accepted ? new Date() : null),
      lastStatus: args.status,
    });

    if (existingProgress) {
      await tx.userProblemProgress.update({
        where: {
          userId_problemId: {
            userId: submission.userId,
            problemId: submission.problemId,
          },
        },
        data: {
          status: nextStatus,
          attempts: { increment: 1 },
          bestScore: Math.max(existingProgress.bestScore, args.score),
          lastStatus: args.status,
          lastSubmissionId: submission.id,
          solvedAt: existingProgress.solvedAt ?? (accepted ? new Date() : null),
        },
      });
    } else {
      await tx.userProblemProgress.create({
        data: {
          userId: submission.userId,
          problemId: submission.problemId,
          status: nextStatus,
          attempts: 1,
          bestScore: args.score,
          lastStatus: args.status,
          lastSubmissionId: submission.id,
          solvedAt: accepted ? new Date() : null,
        },
      });
    }
  });
}
