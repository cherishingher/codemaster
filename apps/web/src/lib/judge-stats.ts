import { db } from "@/lib/db";

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
    select: { id: true, userId: true, problemId: true },
  });
  if (!submission) return;

  const accepted = args.status.toUpperCase() === "AC";
  const maxTimeMs = args.maxTimeMs ?? (args.cases?.length ? Math.max(...args.cases.map((c) => c.timeMs)) : 0);
  const maxMemoryMb = args.maxMemoryMb ?? (args.cases?.length ? Math.max(...args.cases.map((c) => c.memoryMb)) : 0);

  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: args.submissionId },
      data: { status: args.status, score: args.score },
    });

    if (args.cases?.length) {
      await tx.submissionCase.createMany({
        data: args.cases.map((c) => ({
          submissionId: args.submissionId,
          testcaseId: c.testcaseId ?? null,
          status: c.status,
          timeMs: c.timeMs,
          memoryMb: c.memoryMb,
          score: c.score,
        })),
        skipDuplicates: true,
      });
    }

    const stat = await tx.problemStat.findUnique({
      where: { problemId: submission.problemId },
    });

    const total = stat?.totalSubmissions ?? 0;
    const acceptedCount = stat?.acceptedSubmissions ?? 0;
    const newTotal = total + 1;
    const newAccepted = acceptedCount + (accepted ? 1 : 0);
    const newAvgTimeMs = Math.round(((stat?.avgTimeMs ?? 0) * total + maxTimeMs) / newTotal);
    const newAvgMemoryMb = Math.round(((stat?.avgMemoryMb ?? 0) * total + maxMemoryMb) / newTotal);
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
          avgMemoryMb: maxMemoryMb,
        },
      });
    }

    const existingProgress = await tx.userProblemProgress.findUnique({
      where: { userId_problemId: { userId: submission.userId, problemId: submission.problemId } },
    });

    if (existingProgress) {
      await tx.userProblemProgress.update({
        where: { userId_problemId: { userId: submission.userId, problemId: submission.problemId } },
        data: {
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
