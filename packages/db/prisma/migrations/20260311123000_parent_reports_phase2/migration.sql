-- CreateTable
CREATE TABLE "GuardianRelation" (
    "id" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'parent',
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentReportSnapshot" (
    "id" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'weekly',
    "periodStartAt" TIMESTAMP(3) NOT NULL,
    "periodEndAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "payload" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianRelation_guardianUserId_status_createdAt_idx" ON "GuardianRelation"("guardianUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GuardianRelation_studentUserId_status_createdAt_idx" ON "GuardianRelation"("studentUserId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelation_guardianUserId_studentUserId_key" ON "GuardianRelation"("guardianUserId", "studentUserId");

-- CreateIndex
CREATE INDEX "ParentReportSnapshot_guardianUserId_periodType_generatedAt_idx" ON "ParentReportSnapshot"("guardianUserId", "periodType", "generatedAt");

-- CreateIndex
CREATE INDEX "ParentReportSnapshot_studentUserId_periodType_generatedAt_idx" ON "ParentReportSnapshot"("studentUserId", "periodType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentReportSnapshot_guardianUserId_studentUserId_periodTyp_key" ON "ParentReportSnapshot"("guardianUserId", "studentUserId", "periodType", "periodStartAt", "periodEndAt");

-- AddForeignKey
ALTER TABLE "GuardianRelation" ADD CONSTRAINT "GuardianRelation_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelation" ADD CONSTRAINT "GuardianRelation_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReportSnapshot" ADD CONSTRAINT "ParentReportSnapshot_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReportSnapshot" ADD CONSTRAINT "ParentReportSnapshot_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
