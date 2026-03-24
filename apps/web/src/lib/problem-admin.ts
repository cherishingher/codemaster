import { Prisma } from "@prisma/client";
import {
  getDefaultJudgeConfigs,
  isScratchLanguage,
  resolveProblemStatus,
  resolveProblemVisible,
  slugifyProblemTitle,
} from "@/lib/oj";

type ProblemDb = Prisma.TransactionClient;
export type ProblemAdminMode = "code" | "scratch" | "hybrid";

const CODE_TAGS = new Set(["c++", "cpp", "python", "py"]);
const SCRATCH_TAGS = ["scratch", "图形化", "图形化编程", "sb3"];

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

export function problemModeSupportsCode(mode: ProblemAdminMode) {
  return mode === "code" || mode === "hybrid";
}

export function problemModeSupportsScratch(mode: ProblemAdminMode) {
  return mode === "scratch" || mode === "hybrid";
}

export function resolveProblemAdminMode(input: {
  tags?: string[] | null;
  judgeConfigs?: Array<{ language: string }> | null;
}) {
  const normalizedTags = (input.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  const hasScratchTag = normalizedTags.some((tag) =>
    SCRATCH_TAGS.some((keyword) => tag.includes(keyword))
  );
  const hasExplicitCodeTag = normalizedTags.some((tag) => CODE_TAGS.has(tag));

  const hasScratchJudgeConfig = (input.judgeConfigs ?? []).some((config) =>
    isScratchLanguage(config.language)
  );
  const hasCodeJudgeConfig = (input.judgeConfigs ?? []).some(
    (config) => !isScratchLanguage(config.language)
  );

  if (hasScratchTag && hasExplicitCodeTag) return "hybrid";
  if (hasScratchTag) return "scratch";
  if (hasExplicitCodeTag) return "code";

  const supportsScratch = hasScratchTag || hasScratchJudgeConfig;
  const supportsCode = hasExplicitCodeTag || hasCodeJudgeConfig || !supportsScratch;

  if (supportsScratch && supportsCode) return "hybrid";
  if (supportsScratch) return "scratch";
  return "code";
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
