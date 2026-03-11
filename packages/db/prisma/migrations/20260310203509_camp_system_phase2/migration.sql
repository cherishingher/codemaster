-- DropForeignKey
ALTER TABLE "ProductBenefit" DROP CONSTRAINT "ProductBenefit_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductSku" DROP CONSTRAINT "ProductSku_productId_fkey";

-- DropIndex
DROP INDEX "Lesson_sectionId_idx";

-- DropIndex
DROP INDEX "Section_courseId_idx";

-- AlterTable
ALTER TABLE "MembershipSubscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "productId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductBenefit" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductSku" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefundRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Camp" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "suitableFor" TEXT,
    "difficulty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "accessLevel" TEXT NOT NULL DEFAULT 'purchase',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "highlights" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampClass" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coachName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "accessLevel" TEXT NOT NULL DEFAULT 'purchase',
    "enrollStartAt" TIMESTAMP(3),
    "enrollEndAt" TIMESTAMP(3),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampSku" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSkuId" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampEnrollment" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "campSkuId" TEXT,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "sourceType" TEXT NOT NULL DEFAULT 'PURCHASE',
    "sourceId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampTask" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "dayIndex" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'published',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "problemId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 100,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampCheckin" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'checked_in',
    "note" TEXT,
    "payload" JSONB,
    "checkinAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampRankSnapshot" (
    "id" TEXT NOT NULL,
    "campId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'overall',
    "scopeKey" TEXT NOT NULL DEFAULT 'overall',
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "checkinCount" INTEGER NOT NULL DEFAULT 0,
    "solvedProblemCount" INTEGER NOT NULL DEFAULT 0,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "userNameSnapshot" TEXT,
    "payload" JSONB,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampRankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Camp_slug_key" ON "Camp"("slug");

-- CreateIndex
CREATE INDEX "Camp_status_sortOrder_idx" ON "Camp"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Camp_visibility_status_sortOrder_idx" ON "Camp"("visibility", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CampClass_slug_key" ON "CampClass"("slug");

-- CreateIndex
CREATE INDEX "CampClass_campId_status_sortOrder_idx" ON "CampClass"("campId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "CampClass_startAt_endAt_idx" ON "CampClass"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampSku_productSkuId_key" ON "CampSku"("productSkuId");

-- CreateIndex
CREATE INDEX "CampSku_campId_status_sortOrder_idx" ON "CampSku"("campId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "CampSku_classId_status_sortOrder_idx" ON "CampSku"("classId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "CampSku_productId_idx" ON "CampSku"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CampEnrollment_orderId_key" ON "CampEnrollment"("orderId");

-- CreateIndex
CREATE INDEX "CampEnrollment_campId_status_createdAt_idx" ON "CampEnrollment"("campId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CampEnrollment_classId_status_createdAt_idx" ON "CampEnrollment"("classId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CampEnrollment_userId_status_updatedAt_idx" ON "CampEnrollment"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampEnrollment_classId_userId_key" ON "CampEnrollment"("classId", "userId");

-- CreateIndex
CREATE INDEX "CampTask_campId_taskDate_sortOrder_idx" ON "CampTask"("campId", "taskDate", "sortOrder");

-- CreateIndex
CREATE INDEX "CampTask_classId_taskDate_sortOrder_idx" ON "CampTask"("classId", "taskDate", "sortOrder");

-- CreateIndex
CREATE INDEX "CampTask_resourceType_resourceId_idx" ON "CampTask"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "CampTask_problemId_idx" ON "CampTask"("problemId");

-- CreateIndex
CREATE INDEX "CampCheckin_classId_userId_checkinAt_idx" ON "CampCheckin"("classId", "userId", "checkinAt");

-- CreateIndex
CREATE INDEX "CampCheckin_enrollmentId_checkinAt_idx" ON "CampCheckin"("enrollmentId", "checkinAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampCheckin_taskId_userId_key" ON "CampCheckin"("taskId", "userId");

-- CreateIndex
CREATE INDEX "CampRankSnapshot_classId_scope_scopeKey_rank_idx" ON "CampRankSnapshot"("classId", "scope", "scopeKey", "rank");

-- CreateIndex
CREATE INDEX "CampRankSnapshot_campId_scope_scopeKey_idx" ON "CampRankSnapshot"("campId", "scope", "scopeKey");

-- CreateIndex
CREATE INDEX "CampRankSnapshot_userId_scope_snapshotAt_idx" ON "CampRankSnapshot"("userId", "scope", "snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampRankSnapshot_classId_scope_scopeKey_userId_key" ON "CampRankSnapshot"("classId", "scope", "scopeKey", "userId");

-- CreateIndex
CREATE INDEX "Order_productId_createdAt_idx" ON "Order"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- AddForeignKey
ALTER TABLE "ProductSku" ADD CONSTRAINT "ProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBenefit" ADD CONSTRAINT "ProductBenefit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampClass" ADD CONSTRAINT "CampClass_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSku" ADD CONSTRAINT "CampSku_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSku" ADD CONSTRAINT "CampSku_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CampClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSku" ADD CONSTRAINT "CampSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampSku" ADD CONSTRAINT "CampSku_productSkuId_fkey" FOREIGN KEY ("productSkuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampEnrollment" ADD CONSTRAINT "CampEnrollment_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampEnrollment" ADD CONSTRAINT "CampEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CampClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampEnrollment" ADD CONSTRAINT "CampEnrollment_campSkuId_fkey" FOREIGN KEY ("campSkuId") REFERENCES "CampSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampEnrollment" ADD CONSTRAINT "CampEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampEnrollment" ADD CONSTRAINT "CampEnrollment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampTask" ADD CONSTRAINT "CampTask_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampTask" ADD CONSTRAINT "CampTask_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CampClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampTask" ADD CONSTRAINT "CampTask_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampCheckin" ADD CONSTRAINT "CampCheckin_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampCheckin" ADD CONSTRAINT "CampCheckin_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CampClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampCheckin" ADD CONSTRAINT "CampCheckin_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CampTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampCheckin" ADD CONSTRAINT "CampCheckin_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CampEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampCheckin" ADD CONSTRAINT "CampCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampRankSnapshot" ADD CONSTRAINT "CampRankSnapshot_campId_fkey" FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampRankSnapshot" ADD CONSTRAINT "CampRankSnapshot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CampClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampRankSnapshot" ADD CONSTRAINT "CampRankSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
