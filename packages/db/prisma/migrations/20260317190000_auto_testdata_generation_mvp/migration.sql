-- CreateEnum
CREATE TYPE "StandardSolutionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DISABLED', 'INVALID');

-- CreateEnum
CREATE TYPE "TestdataGenerationTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TestdataGenerationTaskStage" AS ENUM ('VALIDATE_CONFIG', 'PREPARE_WORKDIR', 'COMPILE_SOLUTION', 'PLAN_CASES', 'GENERATE_INPUTS', 'VALIDATE_INPUTS', 'RUN_SOLUTION', 'PERSIST_CASES', 'FINALIZE');

-- CreateEnum
CREATE TYPE "TestdataPublishMode" AS ENUM ('APPEND', 'REPLACE_GENERATED', 'REPLACE_ALL');

-- CreateEnum
CREATE TYPE "TestdataCaseStatus" AS ENUM ('PENDING', 'INPUT_READY', 'RUNNING', 'OUTPUT_READY', 'PERSISTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProgramExecutionStatus" AS ENUM ('NOT_STARTED', 'SUCCESS', 'COMPILE_ERROR', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'OUTPUT_LIMIT_EXCEEDED', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "GenerationLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "FileAssetKind" AS ENUM ('SOURCE_CODE', 'TESTCASE_INPUT', 'TESTCASE_EXPECTED_OUTPUT', 'COMPILE_STDOUT', 'COMPILE_STDERR', 'RUNTIME_STDERR', 'TASK_MANIFEST', 'TASK_PACKAGE');

-- CreateEnum
CREATE TYPE "FileStorageProvider" AS ENUM ('LOCAL_FILE', 'S3', 'OSS');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('ACTIVE', 'ORPHANED', 'DELETED');

-- CreateEnum
CREATE TYPE "TestcaseSourceType" AS ENUM ('MANUAL', 'ZIP_IMPORT', 'AUTO_GENERATED');

-- AlterTable
ALTER TABLE "ProblemVersion" ADD COLUMN "testdataGenerationConfig" JSONB;

-- AlterTable
ALTER TABLE "Testcase"
  ADD COLUMN "generationOrdinal" INTEGER,
  ADD COLUMN "generationTaskId" TEXT,
  ADD COLUMN "sourceType" "TestcaseSourceType" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "kind" "FileAssetKind" NOT NULL,
    "storageProvider" "FileStorageProvider" NOT NULL DEFAULT 'LOCAL_FILE',
    "uri" TEXT NOT NULL,
    "bucket" TEXT,
    "objectKey" TEXT,
    "fileName" TEXT NOT NULL,
    "extension" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandardSolution" (
    "id" TEXT NOT NULL,
    "problemVersionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "sourceHash" TEXT,
    "status" "StandardSolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "compileOptions" JSONB,
    "runOptions" JSONB,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestdataGenerationTask" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "problemVersionId" TEXT NOT NULL,
    "standardSolutionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "TestdataGenerationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "stage" "TestdataGenerationTaskStage" NOT NULL DEFAULT 'VALIDATE_CONFIG',
    "mode" "TestdataPublishMode" NOT NULL DEFAULT 'APPEND',
    "queueName" TEXT NOT NULL DEFAULT 'testgen:jobs',
    "workerId" TEXT,
    "batchKey" TEXT,
    "requestFingerprint" TEXT,
    "seed" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "retriedFromTaskId" TEXT,
    "configSnapshot" JSONB NOT NULL,
    "solutionSnapshot" JSONB NOT NULL,
    "plannedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "generatedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCaseCount" INTEGER NOT NULL DEFAULT 0,
    "failedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "persistedCaseCount" INTEGER NOT NULL DEFAULT 0,
    "replacedTestcaseCount" INTEGER NOT NULL DEFAULT 0,
    "compileExitCode" INTEGER,
    "compileDurationMs" INTEGER,
    "compileStdoutAssetId" TEXT,
    "compileStderrAssetId" TEXT,
    "packageAssetId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resultSummary" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestdataGenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestdataCase" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "groupKey" TEXT,
    "title" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "isPretest" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "caseType" INTEGER NOT NULL DEFAULT 1,
    "subtaskId" INTEGER,
    "groupId" TEXT,
    "orderIndex" INTEGER,
    "caseSeed" TEXT,
    "generatorInput" JSONB,
    "inputAssetId" TEXT,
    "expectedOutputAssetId" TEXT,
    "runtimeStderrAssetId" TEXT,
    "status" "TestdataCaseStatus" NOT NULL DEFAULT 'PENDING',
    "executionStatus" "ProgramExecutionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "executionDurationMs" INTEGER,
    "executionMemoryKb" INTEGER,
    "exitCode" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestdataCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestdataGenerationLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "caseId" TEXT,
    "sequenceNo" INTEGER NOT NULL,
    "level" "GenerationLogLevel" NOT NULL,
    "stage" "TestdataGenerationTaskStage" NOT NULL,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "stdoutAssetId" TEXT,
    "stderrAssetId" TEXT,
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestdataGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_uri_key" ON "FileAsset"("uri");
CREATE INDEX "FileAsset_kind_createdAt_idx" ON "FileAsset"("kind", "createdAt");
CREATE INDEX "FileAsset_checksumSha256_idx" ON "FileAsset"("checksumSha256");
CREATE INDEX "FileAsset_createdById_createdAt_idx" ON "FileAsset"("createdById", "createdAt");
CREATE INDEX "FileAsset_status_createdAt_idx" ON "FileAsset"("status", "createdAt");

CREATE INDEX "StandardSolution_problemVersionId_status_isPrimary_idx" ON "StandardSolution"("problemVersionId", "status", "isPrimary");
CREATE INDEX "StandardSolution_uploadedById_createdAt_idx" ON "StandardSolution"("uploadedById", "createdAt");
CREATE INDEX "StandardSolution_sourceHash_idx" ON "StandardSolution"("sourceHash");

CREATE INDEX "TestdataGenerationTask_problemId_createdAt_idx" ON "TestdataGenerationTask"("problemId", "createdAt");
CREATE INDEX "TestdataGenerationTask_problemVersionId_createdAt_idx" ON "TestdataGenerationTask"("problemVersionId", "createdAt");
CREATE INDEX "TestdataGenerationTask_standardSolutionId_createdAt_idx" ON "TestdataGenerationTask"("standardSolutionId", "createdAt");
CREATE INDEX "TestdataGenerationTask_requestedById_createdAt_idx" ON "TestdataGenerationTask"("requestedById", "createdAt");
CREATE INDEX "TestdataGenerationTask_status_createdAt_idx" ON "TestdataGenerationTask"("status", "createdAt");
CREATE INDEX "TestdataGenerationTask_stage_createdAt_idx" ON "TestdataGenerationTask"("stage", "createdAt");
CREATE INDEX "TestdataGenerationTask_batchKey_createdAt_idx" ON "TestdataGenerationTask"("batchKey", "createdAt");
CREATE INDEX "TestdataGenerationTask_retriedFromTaskId_idx" ON "TestdataGenerationTask"("retriedFromTaskId");
CREATE INDEX "TestdataGenerationTask_queueName_status_createdAt_idx" ON "TestdataGenerationTask"("queueName", "status", "createdAt");
CREATE INDEX "TestdataGenerationTask_requestFingerprint_idx" ON "TestdataGenerationTask"("requestFingerprint");

CREATE UNIQUE INDEX "TestdataCase_taskId_ordinal_key" ON "TestdataCase"("taskId", "ordinal");
CREATE INDEX "TestdataCase_taskId_status_ordinal_idx" ON "TestdataCase"("taskId", "status", "ordinal");
CREATE INDEX "TestdataCase_taskId_groupKey_ordinal_idx" ON "TestdataCase"("taskId", "groupKey", "ordinal");
CREATE INDEX "TestdataCase_taskId_executionStatus_idx" ON "TestdataCase"("taskId", "executionStatus");
CREATE INDEX "TestdataCase_inputAssetId_idx" ON "TestdataCase"("inputAssetId");
CREATE INDEX "TestdataCase_expectedOutputAssetId_idx" ON "TestdataCase"("expectedOutputAssetId");

CREATE UNIQUE INDEX "TestdataGenerationLog_taskId_sequenceNo_key" ON "TestdataGenerationLog"("taskId", "sequenceNo");
CREATE INDEX "TestdataGenerationLog_taskId_createdAt_idx" ON "TestdataGenerationLog"("taskId", "createdAt");
CREATE INDEX "TestdataGenerationLog_caseId_createdAt_idx" ON "TestdataGenerationLog"("caseId", "createdAt");
CREATE INDEX "TestdataGenerationLog_taskId_level_createdAt_idx" ON "TestdataGenerationLog"("taskId", "level", "createdAt");
CREATE INDEX "TestdataGenerationLog_taskId_stage_createdAt_idx" ON "TestdataGenerationLog"("taskId", "stage", "createdAt");

CREATE INDEX "Testcase_generationTaskId_generationOrdinal_idx" ON "Testcase"("generationTaskId", "generationOrdinal");

-- AddForeignKey
ALTER TABLE "Testcase"
  ADD CONSTRAINT "Testcase_generationTaskId_fkey"
  FOREIGN KEY ("generationTaskId") REFERENCES "TestdataGenerationTask"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FileAsset"
  ADD CONSTRAINT "FileAsset_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StandardSolution"
  ADD CONSTRAINT "StandardSolution_problemVersionId_fkey"
  FOREIGN KEY ("problemVersionId") REFERENCES "ProblemVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandardSolution"
  ADD CONSTRAINT "StandardSolution_sourceAssetId_fkey"
  FOREIGN KEY ("sourceAssetId") REFERENCES "FileAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandardSolution"
  ADD CONSTRAINT "StandardSolution_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_problemId_fkey"
  FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_problemVersionId_fkey"
  FOREIGN KEY ("problemVersionId") REFERENCES "ProblemVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_standardSolutionId_fkey"
  FOREIGN KEY ("standardSolutionId") REFERENCES "StandardSolution"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_retriedFromTaskId_fkey"
  FOREIGN KEY ("retriedFromTaskId") REFERENCES "TestdataGenerationTask"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_compileStdoutAssetId_fkey"
  FOREIGN KEY ("compileStdoutAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_compileStderrAssetId_fkey"
  FOREIGN KEY ("compileStderrAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationTask"
  ADD CONSTRAINT "TestdataGenerationTask_packageAssetId_fkey"
  FOREIGN KEY ("packageAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestdataCase"
  ADD CONSTRAINT "TestdataCase_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "TestdataGenerationTask"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataCase"
  ADD CONSTRAINT "TestdataCase_inputAssetId_fkey"
  FOREIGN KEY ("inputAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataCase"
  ADD CONSTRAINT "TestdataCase_expectedOutputAssetId_fkey"
  FOREIGN KEY ("expectedOutputAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataCase"
  ADD CONSTRAINT "TestdataCase_runtimeStderrAssetId_fkey"
  FOREIGN KEY ("runtimeStderrAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TestdataGenerationLog"
  ADD CONSTRAINT "TestdataGenerationLog_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "TestdataGenerationTask"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationLog"
  ADD CONSTRAINT "TestdataGenerationLog_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "TestdataCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationLog"
  ADD CONSTRAINT "TestdataGenerationLog_stdoutAssetId_fkey"
  FOREIGN KEY ("stdoutAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestdataGenerationLog"
  ADD CONSTRAINT "TestdataGenerationLog_stderrAssetId_fkey"
  FOREIGN KEY ("stderrAssetId") REFERENCES "FileAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
