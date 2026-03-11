-- CreateTable
CREATE TABLE "ContestRegistration" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "sourceType" TEXT NOT NULL DEFAULT 'PURCHASE',
    "sourceId" TEXT,
    "groupKey" TEXT NOT NULL DEFAULT 'public',
    "groupLabel" TEXT NOT NULL DEFAULT '公开组',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestReport" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'personal',
    "groupKey" TEXT,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "penaltyMinutes" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "groupRank" INTEGER,
    "summary" TEXT,
    "payload" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestUnlockRule" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "requiredSource" TEXT NOT NULL DEFAULT 'PURCHASE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestUnlockRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestRegistration_orderId_key" ON "ContestRegistration"("orderId");

-- CreateIndex
CREATE INDEX "ContestRegistration_contestId_status_joinedAt_idx" ON "ContestRegistration"("contestId", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "ContestRegistration_contestId_groupKey_status_joinedAt_idx" ON "ContestRegistration"("contestId", "groupKey", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "ContestRegistration_userId_status_joinedAt_idx" ON "ContestRegistration"("userId", "status", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestRegistration_contestId_userId_key" ON "ContestRegistration"("contestId", "userId");

-- CreateIndex
CREATE INDEX "ContestReport_contestId_reportType_generatedAt_idx" ON "ContestReport"("contestId", "reportType", "generatedAt");

-- CreateIndex
CREATE INDEX "ContestReport_contestId_groupKey_reportType_generatedAt_idx" ON "ContestReport"("contestId", "groupKey", "reportType", "generatedAt");

-- CreateIndex
CREATE INDEX "ContestReport_userId_reportType_generatedAt_idx" ON "ContestReport"("userId", "reportType", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestReport_contestId_userId_reportType_key" ON "ContestReport"("contestId", "userId", "reportType");

-- CreateIndex
CREATE INDEX "ContestUnlockRule_contestId_isEnabled_idx" ON "ContestUnlockRule"("contestId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ContestUnlockRule_contestId_resourceType_key" ON "ContestUnlockRule"("contestId", "resourceType");

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestRegistration" ADD CONSTRAINT "ContestRegistration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestReport" ADD CONSTRAINT "ContestReport_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestReport" ADD CONSTRAINT "ContestReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestUnlockRule" ADD CONSTRAINT "ContestUnlockRule_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
