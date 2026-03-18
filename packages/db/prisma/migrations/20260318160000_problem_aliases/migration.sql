CREATE TABLE "ProblemAlias" (
  "id" TEXT NOT NULL,
  "problemId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProblemAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProblemAlias_normalizedValue_key" ON "ProblemAlias"("normalizedValue");
CREATE INDEX "ProblemAlias_problemId_sortOrder_idx" ON "ProblemAlias"("problemId", "sortOrder");

ALTER TABLE "ProblemAlias"
ADD CONSTRAINT "ProblemAlias_problemId_fkey"
FOREIGN KEY ("problemId") REFERENCES "Problem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
