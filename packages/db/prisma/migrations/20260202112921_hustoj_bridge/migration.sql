-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "hustojSolutionId" INTEGER,
ADD COLUMN     "judgeBackend" TEXT NOT NULL DEFAULT 'hustoj';

-- CreateTable
CREATE TABLE "HustojProblemMap" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "hustojProblemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HustojProblemMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HustojProblemMap_problemId_key" ON "HustojProblemMap"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "HustojProblemMap_hustojProblemId_key" ON "HustojProblemMap"("hustojProblemId");

-- CreateIndex
CREATE INDEX "HustojProblemMap_hustojProblemId_idx" ON "HustojProblemMap"("hustojProblemId");

-- AddForeignKey
ALTER TABLE "HustojProblemMap" ADD CONSTRAINT "HustojProblemMap_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
