-- AlterTable
ALTER TABLE "TeachingGroupProblemSetAssignment"
ADD COLUMN     "gradingMode" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "maxScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TeachingGroupAssignmentGrade" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoScore" INTEGER NOT NULL DEFAULT 0,
    "manualScore" INTEGER,
    "finalScore" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "solvedProblemCount" INTEGER NOT NULL DEFAULT 0,
    "attemptedProblemCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "lastSubmissionAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingGroupAssignmentGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeachingGroupAssignmentGrade_assignmentId_userId_key" ON "TeachingGroupAssignmentGrade"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "TeachingGroupAssignmentGrade_assignmentId_status_finalScore_idx" ON "TeachingGroupAssignmentGrade"("assignmentId", "status", "finalScore");

-- CreateIndex
CREATE INDEX "TeachingGroupAssignmentGrade_userId_updatedAt_idx" ON "TeachingGroupAssignmentGrade"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "TeachingGroupAssignmentGrade_gradedById_gradedAt_idx" ON "TeachingGroupAssignmentGrade"("gradedById", "gradedAt");

-- AddForeignKey
ALTER TABLE "TeachingGroupAssignmentGrade" ADD CONSTRAINT "TeachingGroupAssignmentGrade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingGroupProblemSetAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingGroupAssignmentGrade" ADD CONSTRAINT "TeachingGroupAssignmentGrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingGroupAssignmentGrade" ADD CONSTRAINT "TeachingGroupAssignmentGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
