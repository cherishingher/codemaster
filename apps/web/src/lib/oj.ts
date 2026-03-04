export const ProblemLifecycleStatus = {
  DRAFT: 0,
  REVIEW: 10,
  PUBLISHED: 20,
  ARCHIVED: 30,
} as const;

export const TestcaseType = {
  SAMPLE: 0,
  HIDDEN: 1,
  STRESS: 2,
} as const;

export const UserProblemStatus = {
  NOT_STARTED: 0,
  ATTEMPTED: 10,
  ACCEPTED: 20,
} as const;

export const SubmissionJudgeResult = {
  PENDING: 0,
  WAITING: 1,
  RUNNING: 2,
  ACCEPTED: 4,
  PRESENTATION_ERROR: 5,
  WRONG_ANSWER: 6,
  TIME_LIMIT_EXCEEDED: 7,
  MEMORY_LIMIT_EXCEEDED: 8,
  OUTPUT_LIMIT_EXCEEDED: 9,
  RUNTIME_ERROR: 10,
  COMPILE_ERROR: 11,
  PARTIAL_ACCEPTED: 12,
  SYSTEM_ERROR: 13,
} as const;

export type SubmissionUiStatus =
  | "PENDING"
  | "JUDGING"
  | "ACCEPTED"
  | "PARTIAL"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILE_ERROR"
  | "SYSTEM_ERROR";

export const LanguageId = {
  CPP17: 1,
  CPP14: 1,
  CPP11: 1,
  PYTHON: 6,
  SCRATCH_OPTIONAL: 1001,
  SCRATCH_MUST: 1002,
} as const;

type DefaultJudgeConfig = {
  language: string;
  languageId: number;
  judgeMode: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  isDefault: boolean;
  sortOrder: number;
};

const LANGUAGE_ALIAS_TO_ID: Record<string, number> = {
  cpp17: LanguageId.CPP17,
  "c++17": LanguageId.CPP17,
  cpp14: LanguageId.CPP14,
  "c++14": LanguageId.CPP14,
  cpp11: LanguageId.CPP11,
  "c++11": LanguageId.CPP11,
  python: LanguageId.PYTHON,
  py: LanguageId.PYTHON,
  "scratch-optional": LanguageId.SCRATCH_OPTIONAL,
  "scratch-must": LanguageId.SCRATCH_MUST,
  sb3: LanguageId.SCRATCH_OPTIONAL,
};

export function slugifyProblemTitle(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "problem";
}

export function normalizeLanguage(language: string) {
  return language.trim().toLowerCase();
}

export function getLanguageId(language: string) {
  return LANGUAGE_ALIAS_TO_ID[normalizeLanguage(language)] ?? null;
}

export function resolveProblemStatus(visibility: string | null | undefined) {
  if (visibility === "public" || visibility === "contest") {
    return ProblemLifecycleStatus.PUBLISHED;
  }
  return ProblemLifecycleStatus.DRAFT;
}

export function resolveProblemVisible(visibility: string | null | undefined) {
  return visibility === "public" || visibility === "contest";
}

export function isScratchLanguage(language: string) {
  const normalized = normalizeLanguage(language);
  return normalized === "sb3" || normalized.startsWith("scratch");
}

export function getDefaultJudgeConfigs(input: {
  tags?: string[];
  timeLimitMs?: number | null;
  memoryLimitMb?: number | null;
}) {
  const tags = (input.tags ?? []).map((tag) => tag.toLowerCase());
  const scratchOnly = tags.some((tag) => tag.includes("scratch"));

  const base: DefaultJudgeConfig[] = scratchOnly
    ? []
    : [
        {
          language: "cpp17",
          languageId: LanguageId.CPP17,
          judgeMode: "standard",
          timeLimitMs: input.timeLimitMs ?? undefined,
          memoryLimitMb: input.memoryLimitMb ?? undefined,
          isDefault: true,
          sortOrder: 10,
        },
        {
          language: "cpp14",
          languageId: LanguageId.CPP14,
          judgeMode: "standard",
          timeLimitMs: input.timeLimitMs ?? undefined,
          memoryLimitMb: input.memoryLimitMb ?? undefined,
          isDefault: false,
          sortOrder: 20,
        },
        {
          language: "cpp11",
          languageId: LanguageId.CPP11,
          judgeMode: "standard",
          timeLimitMs: input.timeLimitMs ?? undefined,
          memoryLimitMb: input.memoryLimitMb ?? undefined,
          isDefault: false,
          sortOrder: 30,
        },
        {
          language: "python",
          languageId: LanguageId.PYTHON,
          judgeMode: "standard",
          timeLimitMs: input.timeLimitMs ?? undefined,
          memoryLimitMb: input.memoryLimitMb ?? undefined,
          isDefault: false,
          sortOrder: 40,
        },
      ];

  if (tags.some((tag) => tag.includes("scratch"))) {
    base.push({
      language: tags.some((tag) => tag.includes("必"))
        ? "scratch-must"
        : "scratch-optional",
      languageId: tags.some((tag) => tag.includes("必"))
        ? LanguageId.SCRATCH_MUST
        : LanguageId.SCRATCH_OPTIONAL,
      judgeMode: "scratch",
      isDefault: base.length === 0,
      sortOrder: 50,
    });
  }

  return base;
}

export function toSubmissionJudgeResult(status: string) {
  switch (status.toUpperCase()) {
    case "QUEUED":
      return SubmissionJudgeResult.PENDING;
    case "RUNNING":
      return SubmissionJudgeResult.RUNNING;
    case "AC":
    case "ACCEPTED":
      return SubmissionJudgeResult.ACCEPTED;
    case "PARTIAL":
    case "PARTIAL_ACCEPTED":
      return SubmissionJudgeResult.PARTIAL_ACCEPTED;
    case "PE":
      return SubmissionJudgeResult.PRESENTATION_ERROR;
    case "WA":
    case "WRONG_ANSWER":
      return SubmissionJudgeResult.WRONG_ANSWER;
    case "TLE":
    case "TIME_LIMIT_EXCEEDED":
      return SubmissionJudgeResult.TIME_LIMIT_EXCEEDED;
    case "MLE":
    case "MEMORY_LIMIT_EXCEEDED":
      return SubmissionJudgeResult.MEMORY_LIMIT_EXCEEDED;
    case "OLE":
    case "OUTPUT_LIMIT_EXCEEDED":
      return SubmissionJudgeResult.OUTPUT_LIMIT_EXCEEDED;
    case "RE":
    case "RUNTIME_ERROR":
      return SubmissionJudgeResult.RUNTIME_ERROR;
    case "CE":
    case "COMPILE_ERROR":
      return SubmissionJudgeResult.COMPILE_ERROR;
    case "FAILED":
    case "SYSTEM_ERROR":
    case "UNKNOWN":
    default:
      return SubmissionJudgeResult.SYSTEM_ERROR;
  }
}

export function mapSubmissionStatusToUi(status: string): SubmissionUiStatus {
  switch (status.toUpperCase()) {
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
      return "JUDGING";
    case "AC":
    case "ACCEPTED":
      return "ACCEPTED";
    case "PARTIAL":
    case "PARTIAL_ACCEPTED":
      return "PARTIAL";
    case "WA":
    case "WRONG_ANSWER":
      return "WRONG_ANSWER";
    case "TLE":
    case "TIME_LIMIT_EXCEEDED":
      return "TIME_LIMIT_EXCEEDED";
    case "MLE":
    case "MEMORY_LIMIT_EXCEEDED":
      return "MEMORY_LIMIT_EXCEEDED";
    case "RE":
    case "RUNTIME_ERROR":
      return "RUNTIME_ERROR";
    case "CE":
    case "COMPILE_ERROR":
      return "COMPILE_ERROR";
    case "PE":
    case "OLE":
    case "OUTPUT_LIMIT_EXCEEDED":
    case "FAILED":
    case "SYSTEM_ERROR":
    case "UNKNOWN":
    default:
      return "SYSTEM_ERROR";
  }
}

export function getSubmissionErrorMessage(input: {
  compileInfo?: { message?: string | null } | null;
  runtimeInfo?: { stderrPreview?: string | null; checkerMessage?: string | null } | null;
}) {
  return (
    input.compileInfo?.message ??
    input.runtimeInfo?.stderrPreview ??
    input.runtimeInfo?.checkerMessage ??
    null
  );
}

export function isFinalJudgeStatus(status: string) {
  const normalized = status.toUpperCase();
  return [
    "AC",
    "ACCEPTED",
    "PARTIAL",
    "PARTIAL_ACCEPTED",
    "WA",
    "WRONG_ANSWER",
    "TLE",
    "TIME_LIMIT_EXCEEDED",
    "MLE",
    "MEMORY_LIMIT_EXCEEDED",
    "OLE",
    "OUTPUT_LIMIT_EXCEEDED",
    "RE",
    "RUNTIME_ERROR",
    "CE",
    "COMPILE_ERROR",
    "PE",
    "FAILED",
    "SYSTEM_ERROR",
    "UNKNOWN",
  ].includes(normalized);
}

export function deriveUserProblemStatus(input: {
  attempts: number;
  solvedAt?: Date | string | null;
  lastStatus?: string | null;
}) {
  if (input.solvedAt || input.lastStatus?.toUpperCase() === "AC") {
    return UserProblemStatus.ACCEPTED;
  }
  if (input.attempts > 0) {
    return UserProblemStatus.ATTEMPTED;
  }
  return UserProblemStatus.NOT_STARTED;
}
