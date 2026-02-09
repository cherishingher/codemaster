-- CreateTable
CREATE TABLE "UserProblemProgress" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" TEXT,
    "solvedAt" TIMESTAMP(3),
    "lastSubmissionId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProblemProgress_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateIndex
CREATE INDEX "UserProblemProgress_userId_updatedAt_idx" ON "UserProblemProgress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "UserProblemProgress_problemId_idx" ON "UserProblemProgress"("problemId");

-- AddForeignKey
ALTER TABLE "UserProblemProgress" ADD CONSTRAINT "UserProblemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemProgress" ADD CONSTRAINT "UserProblemProgress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
