import { Prisma } from "@prisma/client";
import {
  getDefaultJudgeConfigs,
  resolveProblemStatus,
  resolveProblemVisible,
  slugifyProblemTitle,
} from "@/lib/oj";

type ProblemDb = Prisma.TransactionClient;

export async function generateUniqueProblemSlug(
  db: ProblemDb,
  title: string,
  excludeProblemId?: string
) {
  const base = slugifyProblemTitle(title);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await db.problem.findFirst({
      where: {
        slug,
        ...(excludeProblemId ? { id: { not: excludeProblemId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function buildProblemLifecycleData(visibility?: string | null) {
  const resolvedVisibility = visibility ?? "public";
  return {
    status: resolveProblemStatus(resolvedVisibility),
    visible: resolveProblemVisible(resolvedVisibility),
    defunct: "N",
    publishedAt:
      resolvedVisibility === "public" || resolvedVisibility === "contest"
        ? new Date()
        : null,
  };
}

export function buildJudgeConfigCreateManyInput(args: {
  versionId: string;
  tags?: string[];
  timeLimitMs?: number | null;
  memoryLimitMb?: number | null;
}) {
  return getDefaultJudgeConfigs({
    tags: args.tags,
    timeLimitMs: args.timeLimitMs,
    memoryLimitMb: args.memoryLimitMb,
  }).map((config) => ({
    versionId: args.versionId,
    language: config.language,
    languageId: config.languageId,
    judgeMode: config.judgeMode,
    timeLimitMs: config.timeLimitMs ?? null,
    memoryLimitMb: config.memoryLimitMb ?? null,
    isEnabled: true,
    isDefault: config.isDefault,
    sortOrder: config.sortOrder,
  }));
}
