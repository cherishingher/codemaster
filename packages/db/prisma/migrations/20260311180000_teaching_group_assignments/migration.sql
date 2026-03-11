CREATE TABLE "TeachingGroupProblemSetAssignment" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "problemSetId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "title" TEXT,
  "note" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingGroupProblemSetAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeachingGroupProblemSetAssignment_groupId_problemSetId_key"
  ON "TeachingGroupProblemSetAssignment"("groupId", "problemSetId");

CREATE INDEX "TeachingGroupProblemSetAssignment_groupId_status_createdAt_idx"
  ON "TeachingGroupProblemSetAssignment"("groupId", "status", "createdAt");

CREATE INDEX "TeachingGroupProblemSetAssignment_problemSetId_status_createdAt_idx"
  ON "TeachingGroupProblemSetAssignment"("problemSetId", "status", "createdAt");

CREATE INDEX "TeachingGroupProblemSetAssignment_assignedById_createdAt_idx"
  ON "TeachingGroupProblemSetAssignment"("assignedById", "createdAt");

ALTER TABLE "TeachingGroupProblemSetAssignment"
  ADD CONSTRAINT "TeachingGroupProblemSetAssignment_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeachingGroupProblemSetAssignment"
  ADD CONSTRAINT "TeachingGroupProblemSetAssignment_problemSetId_fkey"
  FOREIGN KEY ("problemSetId") REFERENCES "ProblemSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingGroupProblemSetAssignment"
  ADD CONSTRAINT "TeachingGroupProblemSetAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
