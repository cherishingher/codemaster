CREATE TABLE "AdminProblemBulkOperationLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "selectionMode" TEXT NOT NULL,
  "filters" JSONB,
  "payload" JSONB NOT NULL,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "targets" JSONB NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminProblemBulkOperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminProblemBulkOperationLog_adminId_createdAt_idx"
  ON "AdminProblemBulkOperationLog"("adminId", "createdAt");

CREATE INDEX "AdminProblemBulkOperationLog_action_createdAt_idx"
  ON "AdminProblemBulkOperationLog"("action", "createdAt");

ALTER TABLE "AdminProblemBulkOperationLog"
  ADD CONSTRAINT "AdminProblemBulkOperationLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
