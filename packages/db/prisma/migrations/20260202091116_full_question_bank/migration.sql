-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "ProblemVersion" ADD COLUMN     "constraints" TEXT,
ADD COLUMN     "inputFormat" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "outputFormat" TEXT,
ADD COLUMN     "samples" JSONB;

-- AlterTable
ALTER TABLE "Testcase" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderIndex" INTEGER;

-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "versionId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'official',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemSet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemSetItem" (
    "setId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "ProblemSetItem_pkey" PRIMARY KEY ("setId","problemId")
);

-- CreateTable
CREATE TABLE "ProblemStat" (
    "problemId" TEXT NOT NULL,
    "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
    "acceptedSubmissions" INTEGER NOT NULL DEFAULT 0,
    "passRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTimeMs" INTEGER NOT NULL DEFAULT 0,
    "avgMemoryMb" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemStat_pkey" PRIMARY KEY ("problemId")
);

-- CreateIndex
CREATE INDEX "Solution_problemId_createdAt_idx" ON "Solution"("problemId", "createdAt");

-- CreateIndex
CREATE INDEX "Solution_authorId_createdAt_idx" ON "Solution"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ProblemSetItem_setId_orderIndex_idx" ON "ProblemSetItem"("setId", "orderIndex");

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProblemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSet" ADD CONSTRAINT "ProblemSet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSetItem" ADD CONSTRAINT "ProblemSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ProblemSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSetItem" ADD CONSTRAINT "ProblemSetItem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStat" ADD CONSTRAINT "ProblemStat_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
