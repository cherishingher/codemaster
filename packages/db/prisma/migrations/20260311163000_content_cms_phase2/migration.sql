-- Content CMS phase 2
ALTER TABLE "Solution"
  ADD COLUMN "templateType" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ProblemSet"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'training_path',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Lesson"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ContentAsset" (
  "id" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "sourceUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "durationSec" INTEGER,
  "thumbnailUrl" TEXT,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "metadata" JSONB,
  "uploaderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentWorkflowLog" (
  "id" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "payload" JSONB,
  "operatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ContentWorkflowLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProblemSet_slug_key" ON "ProblemSet"("slug");
CREATE INDEX "Lesson_status_sortOrder_idx" ON "Lesson"("status", "sortOrder");
CREATE INDEX "Solution_status_createdAt_idx" ON "Solution"("status", "createdAt");
CREATE INDEX "ProblemSet_kind_status_createdAt_idx" ON "ProblemSet"("kind", "status", "createdAt");
CREATE INDEX "ProblemSet_visibility_status_createdAt_idx" ON "ProblemSet"("visibility", "status", "createdAt");
CREATE INDEX "ContentAsset_assetType_status_createdAt_idx" ON "ContentAsset"("assetType", "status", "createdAt");
CREATE INDEX "ContentAsset_resourceType_resourceId_idx" ON "ContentAsset"("resourceType", "resourceId");
CREATE INDEX "ContentAsset_uploaderId_createdAt_idx" ON "ContentAsset"("uploaderId", "createdAt");
CREATE INDEX "ContentWorkflowLog_resourceType_resourceId_createdAt_idx" ON "ContentWorkflowLog"("resourceType", "resourceId", "createdAt");
CREATE INDEX "ContentWorkflowLog_operatorId_createdAt_idx" ON "ContentWorkflowLog"("operatorId", "createdAt");
CREATE INDEX "ContentWorkflowLog_toStatus_createdAt_idx" ON "ContentWorkflowLog"("toStatus", "createdAt");

ALTER TABLE "ContentAsset"
  ADD CONSTRAINT "ContentAsset_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentWorkflowLog"
  ADD CONSTRAINT "ContentWorkflowLog_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
