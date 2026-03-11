-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "accessLevel" TEXT,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "registrationEndAt" TIMESTAMP(3),
ADD COLUMN     "registrationLimit" INTEGER,
ADD COLUMN     "registrationStartAt" TIMESTAMP(3),
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

-- AlterTable
ALTER TABLE "ContestParticipant" ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'PURCHASE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Contest_status_sortOrder_idx" ON "Contest"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Contest_visibility_status_sortOrder_idx" ON "Contest"("visibility", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ContestParticipant_orderId_key" ON "ContestParticipant"("orderId");

-- CreateIndex
CREATE INDEX "ContestParticipant_contestId_status_joinedAt_idx" ON "ContestParticipant"("contestId", "status", "joinedAt");

-- CreateIndex
CREATE INDEX "ContestParticipant_userId_status_joinedAt_idx" ON "ContestParticipant"("userId", "status", "joinedAt");

-- AddForeignKey
ALTER TABLE "ContestParticipant" ADD CONSTRAINT "ContestParticipant_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

