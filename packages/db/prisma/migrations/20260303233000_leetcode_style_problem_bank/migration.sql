-- LeetCode-style problem bank upgrade.
-- This migration keeps the existing OJ tables and adds compatibility fields/tables
-- for slugs, current versions, judge configs, source/compile/runtime splits,
-- testcase visibility grouping, and richer submission metadata.

-- Problem
ALTER TABLE "Problem"
  ADD COLUMN "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentVersionId" TEXT,
  ADD COLUMN "defunct" CHAR(1) NOT NULL DEFAULT 'N',
  ADD COLUMN "passRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "status" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

WITH ranked_problem_slugs AS (
  SELECT
    p.id,
    COALESCE(
      NULLIF(
        trim(BOTH '-' FROM lower(regexp_replace(p.title, '[^a-zA-Z0-9]+', '-', 'g'))),
        ''
      ),
      'problem'
    ) AS base_slug,
    row_number() OVER (
      PARTITION BY COALESCE(
        NULLIF(
          trim(BOTH '-' FROM lower(regexp_replace(p.title, '[^a-zA-Z0-9]+', '-', 'g'))),
          ''
        ),
        'problem'
      )
      ORDER BY p."createdAt", p.id
    ) AS rn
  FROM "Problem" p
)
UPDATE "Problem" p
SET "slug" = CASE
    WHEN ranked_problem_slugs.rn = 1 THEN ranked_problem_slugs.base_slug
    ELSE ranked_problem_slugs.base_slug || '-' || ranked_problem_slugs.rn
  END,
  "status" = CASE
    WHEN p."visibility" IN ('public', 'contest') THEN 20
    ELSE 0
  END,
  "visible" = CASE
    WHEN p."visibility" IN ('public', 'contest') THEN TRUE
    ELSE FALSE
  END,
  "publishedAt" = CASE
    WHEN p."visibility" IN ('public', 'contest') THEN p."createdAt"
    ELSE NULL
  END
FROM ranked_problem_slugs
WHERE p.id = ranked_problem_slugs.id;

UPDATE "Problem" p
SET "totalSubmissions" = COALESCE(ps."totalSubmissions", 0),
    "acceptedSubmissions" = COALESCE(ps."acceptedSubmissions", 0),
    "passRate" = COALESCE(ps."passRate", 0)
FROM "ProblemStat" ps
WHERE ps."problemId" = p.id;

WITH ranked_versions AS (
  SELECT
    pv.id,
    pv."problemId",
    row_number() OVER (
      PARTITION BY pv."problemId"
      ORDER BY pv."version" DESC, pv.id DESC
    ) AS rn
  FROM "ProblemVersion" pv
)
UPDATE "Problem" p
SET "currentVersionId" = ranked_versions.id
FROM ranked_versions
WHERE p.id = ranked_versions."problemId"
  AND ranked_versions.rn = 1;

ALTER TABLE "Problem"
  ALTER COLUMN "slug" SET NOT NULL;

-- ProblemVersion
ALTER TABLE "ProblemVersion"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "hints" TEXT,
  ADD COLUMN "statementMd" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ProblemVersion"
SET "statementMd" = "statement",
    "hints" = COALESCE("hints", "notes"),
    "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "statementMd" IS NULL
   OR "hints" IS NULL
   OR "updatedAt" IS NULL;

ALTER TABLE "ProblemVersion"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- Submission
ALTER TABLE "Submission"
  ADD COLUMN "defunct" CHAR(1) NOT NULL DEFAULT 'N',
  ADD COLUMN "finishedAt" TIMESTAMP(3),
  ADD COLUMN "judgeResult" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "languageId" INTEGER,
  ADD COLUMN "memoryUsedKb" INTEGER,
  ADD COLUMN "timeUsedMs" INTEGER,
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Submission"
SET "languageId" = CASE lower("lang")
      WHEN 'cpp17' THEN 1
      WHEN 'c++17' THEN 1
      WHEN 'cpp14' THEN 1
      WHEN 'c++14' THEN 1
      WHEN 'cpp11' THEN 1
      WHEN 'c++11' THEN 1
      WHEN 'python' THEN 6
      WHEN 'py' THEN 6
      WHEN 'scratch-optional' THEN 1001
      WHEN 'sb3' THEN 1001
      WHEN 'scratch-must' THEN 1002
      ELSE NULL
    END,
    "judgeResult" = CASE upper("status")
      WHEN 'QUEUED' THEN 0
      WHEN 'RUNNING' THEN 2
      WHEN 'AC' THEN 4
      WHEN 'PE' THEN 5
      WHEN 'WA' THEN 6
      WHEN 'TLE' THEN 7
      WHEN 'MLE' THEN 8
      WHEN 'OLE' THEN 9
      WHEN 'RE' THEN 10
      WHEN 'CE' THEN 11
      WHEN 'PARTIAL' THEN 12
      WHEN 'FAILED' THEN 13
      ELSE 13
    END,
    "finishedAt" = CASE
      WHEN upper("status") IN ('QUEUED', 'RUNNING') THEN NULL
      ELSE "createdAt"
    END,
    "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "visible" = TRUE,
    "defunct" = 'N';

WITH submission_case_rollup AS (
  SELECT
    "submissionId",
    MAX("timeMs") AS max_time_ms,
    MAX("memoryMb") AS max_memory_kb
  FROM "SubmissionCase"
  GROUP BY "submissionId"
)
UPDATE "Submission" s
SET "timeUsedMs" = submission_case_rollup.max_time_ms,
    "memoryUsedKb" = submission_case_rollup.max_memory_kb
FROM submission_case_rollup
WHERE s.id = submission_case_rollup."submissionId";

ALTER TABLE "Submission"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- SubmissionCase
ALTER TABLE "SubmissionCase"
  ADD COLUMN "checkerMessage" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "expectedPreview" TEXT,
  ADD COLUMN "inputPreview" TEXT,
  ADD COLUMN "judgeResult" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ordinal" INTEGER,
  ADD COLUMN "outputPreview" TEXT;

WITH ranked_submission_cases AS (
  SELECT
    sc.id,
    row_number() OVER (
      PARTITION BY sc."submissionId"
      ORDER BY COALESCE(sc."testcaseId", sc.id), sc.id
    ) AS rn
  FROM "SubmissionCase" sc
)
UPDATE "SubmissionCase" sc
SET "ordinal" = ranked_submission_cases.rn,
    "judgeResult" = CASE upper(sc."status")
      WHEN 'ACCEPTED' THEN 4
      WHEN 'AC' THEN 4
      WHEN 'PARTIAL' THEN 12
      WHEN 'WRONG_ANSWER' THEN 6
      WHEN 'WA' THEN 6
      WHEN 'TIME_LIMIT_EXCEEDED' THEN 7
      WHEN 'TLE' THEN 7
      WHEN 'MEMORY_LIMIT_EXCEEDED' THEN 8
      WHEN 'MLE' THEN 8
      WHEN 'OUTPUT_LIMIT_EXCEEDED' THEN 9
      WHEN 'OLE' THEN 9
      WHEN 'RUNTIME_ERROR' THEN 10
      WHEN 'RE' THEN 10
      WHEN 'COMPILE_ERROR' THEN 11
      WHEN 'CE' THEN 11
      ELSE 13
    END
FROM ranked_submission_cases
WHERE sc.id = ranked_submission_cases.id;

-- Testcase
ALTER TABLE "Testcase"
  ADD COLUMN "caseType" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3),
  ADD COLUMN "visible" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Testcase"
SET "title" = COALESCE(
      "title",
      CASE
        WHEN "isSample" THEN 'sample'
        WHEN lower(COALESCE("groupId", '')) = 'stress' THEN 'stress'
        ELSE 'hidden'
      END
    ),
    "caseType" = CASE
      WHEN "isSample" THEN 0
      WHEN lower(COALESCE("groupId", '')) = 'stress' THEN 2
      ELSE 1
    END,
    "visible" = COALESCE("isSample", FALSE),
    "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "Testcase"
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- UserProblemProgress
ALTER TABLE "UserProblemProgress"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "status" INTEGER NOT NULL DEFAULT 0;

UPDATE "UserProblemProgress"
SET "createdAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP),
    "status" = CASE
      WHEN "solvedAt" IS NOT NULL OR upper(COALESCE("lastStatus", '')) = 'AC' THEN 20
      WHEN "attempts" > 0 THEN 10
      ELSE 0
    END;

-- New split tables
CREATE TABLE "ProblemJudgeConfig" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "judgeMode" TEXT NOT NULL DEFAULT 'standard',
    "timeLimitMs" INTEGER,
    "memoryLimitMb" INTEGER,
    "templateCode" TEXT,
    "templateCodeUri" TEXT,
    "entrypoint" TEXT,
    "entrySignature" TEXT,
    "compileCommand" TEXT,
    "runCommand" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemJudgeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceCode" (
    "submissionId" TEXT NOT NULL,
    "source" TEXT,
    "objectKey" TEXT,
    "storageType" TEXT NOT NULL DEFAULT 'inline',
    "sourceSize" INTEGER,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCode_pkey" PRIMARY KEY ("submissionId")
);

CREATE TABLE "CompileInfo" (
    "submissionId" TEXT NOT NULL,
    "compiler" TEXT,
    "command" TEXT,
    "exitCode" INTEGER,
    "message" TEXT,
    "objectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompileInfo_pkey" PRIMARY KEY ("submissionId")
);

CREATE TABLE "RuntimeInfo" (
    "submissionId" TEXT NOT NULL,
    "exitCode" INTEGER,
    "signal" TEXT,
    "stdoutPreview" TEXT,
    "stderrPreview" TEXT,
    "checkerMessage" TEXT,
    "objectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeInfo_pkey" PRIMARY KEY ("submissionId")
);

INSERT INTO "SourceCode" (
  "submissionId",
  "source",
  "objectKey",
  "storageType",
  "sourceSize",
  "sourceHash",
  "createdAt",
  "updatedAt"
)
SELECT
  s.id,
  s.code,
  s."codeUri",
  CASE
    WHEN s.code IS NOT NULL THEN 'inline'
    WHEN s."codeUri" IS NOT NULL THEN 'uri'
    ELSE 'inline'
  END,
  CASE
    WHEN s.code IS NOT NULL THEN char_length(s.code)
    ELSE NULL
  END,
  CASE
    WHEN s.code IS NOT NULL THEN md5(s.code)
    ELSE NULL
  END,
  s."createdAt",
  COALESCE(s."updatedAt", s."createdAt", CURRENT_TIMESTAMP)
FROM "Submission" s
WHERE s.code IS NOT NULL OR s."codeUri" IS NOT NULL;

WITH scratch_versions AS (
  SELECT DISTINCT
    pv.id AS version_id,
    CASE
      WHEN MAX(CASE WHEN t.name LIKE '%必%' THEN 1 ELSE 0 END) = 1 THEN 'scratch-must'
      ELSE 'scratch-optional'
    END AS language,
    CASE
      WHEN MAX(CASE WHEN t.name LIKE '%必%' THEN 1 ELSE 0 END) = 1 THEN 1002
      ELSE 1001
    END AS language_id
  FROM "ProblemVersion" pv
  JOIN "Problem" p ON p.id = pv."problemId"
  JOIN "ProblemTag" pt ON pt."problemId" = p.id
  JOIN "Tag" t ON t.id = pt."tagId"
  WHERE lower(t.name) LIKE '%scratch%'
  GROUP BY pv.id
)
INSERT INTO "ProblemJudgeConfig" (
  "id",
  "versionId",
  "language",
  "languageId",
  "judgeMode",
  "timeLimitMs",
  "memoryLimitMb",
  "isEnabled",
  "isDefault",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'cfg-' || md5(pv.id || '-' || cfg.language),
  pv.id,
  cfg.language,
  cfg.language_id,
  'standard',
  pv."timeLimitMs",
  pv."memoryLimitMb",
  TRUE,
  cfg.is_default,
  cfg.sort_order,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProblemVersion" pv
LEFT JOIN scratch_versions sv ON sv.version_id = pv.id
JOIN (
  VALUES
    ('cpp17', 1, TRUE, 10),
    ('cpp14', 1, FALSE, 20),
    ('cpp11', 1, FALSE, 30),
    ('python', 6, FALSE, 40)
) AS cfg(language, language_id, is_default, sort_order) ON TRUE
WHERE sv.version_id IS NULL;

WITH scratch_versions AS (
  SELECT DISTINCT
    pv.id AS version_id,
    CASE
      WHEN MAX(CASE WHEN t.name LIKE '%必%' THEN 1 ELSE 0 END) = 1 THEN 'scratch-must'
      ELSE 'scratch-optional'
    END AS language,
    CASE
      WHEN MAX(CASE WHEN t.name LIKE '%必%' THEN 1 ELSE 0 END) = 1 THEN 1002
      ELSE 1001
    END AS language_id
  FROM "ProblemVersion" pv
  JOIN "Problem" p ON p.id = pv."problemId"
  JOIN "ProblemTag" pt ON pt."problemId" = p.id
  JOIN "Tag" t ON t.id = pt."tagId"
  WHERE lower(t.name) LIKE '%scratch%'
  GROUP BY pv.id
)
INSERT INTO "ProblemJudgeConfig" (
  "id",
  "versionId",
  "language",
  "languageId",
  "judgeMode",
  "timeLimitMs",
  "memoryLimitMb",
  "isEnabled",
  "isDefault",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'cfg-' || md5(version_id || '-scratch'),
  version_id,
  language,
  language_id,
  'scratch',
  pv."timeLimitMs",
  pv."memoryLimitMb",
  TRUE,
  TRUE,
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM scratch_versions sv
JOIN "ProblemVersion" pv ON pv.id = sv.version_id;

-- Indexes and constraints
CREATE INDEX "ProblemJudgeConfig_versionId_isEnabled_sortOrder_idx"
  ON "ProblemJudgeConfig"("versionId", "isEnabled", "sortOrder");
CREATE INDEX "ProblemJudgeConfig_languageId_idx"
  ON "ProblemJudgeConfig"("languageId");
CREATE UNIQUE INDEX "ProblemJudgeConfig_versionId_language_key"
  ON "ProblemJudgeConfig"("versionId", "language");

CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");
CREATE UNIQUE INDEX "Problem_currentVersionId_key" ON "Problem"("currentVersionId");
CREATE INDEX "Problem_status_visible_defunct_publishedAt_idx"
  ON "Problem"("status", "visible", "defunct", "publishedAt");
CREATE INDEX "Problem_createdAt_idx" ON "Problem"("createdAt");

CREATE INDEX "ProblemVersion_problemId_createdAt_idx"
  ON "ProblemVersion"("problemId", "createdAt");

CREATE INDEX "Submission_judgeResult_createdAt_idx"
  ON "Submission"("judgeResult", "createdAt");
CREATE INDEX "Submission_problemVersionId_createdAt_idx"
  ON "Submission"("problemVersionId", "createdAt");

CREATE INDEX "SubmissionCase_submissionId_ordinal_idx"
  ON "SubmissionCase"("submissionId", "ordinal");
CREATE UNIQUE INDEX "SubmissionCase_submissionId_testcaseId_key"
  ON "SubmissionCase"("submissionId", "testcaseId");

CREATE INDEX "Testcase_versionId_caseType_orderIndex_idx"
  ON "Testcase"("versionId", "caseType", "orderIndex");
CREATE INDEX "Testcase_versionId_groupId_idx"
  ON "Testcase"("versionId", "groupId");

CREATE INDEX "UserProblemProgress_userId_status_updatedAt_idx"
  ON "UserProblemProgress"("userId", "status", "updatedAt");

ALTER TABLE "Problem"
  ADD CONSTRAINT "Problem_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "ProblemVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionCase"
  ADD CONSTRAINT "SubmissionCase_testcaseId_fkey"
  FOREIGN KEY ("testcaseId") REFERENCES "Testcase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProblemJudgeConfig"
  ADD CONSTRAINT "ProblemJudgeConfig_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ProblemVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SourceCode"
  ADD CONSTRAINT "SourceCode_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompileInfo"
  ADD CONSTRAINT "CompileInfo_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RuntimeInfo"
  ADD CONSTRAINT "RuntimeInfo_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
