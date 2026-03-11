CREATE TABLE "MembershipSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "skuId" TEXT,
  "tier" TEXT NOT NULL DEFAULT 'VIP',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MembershipSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipSubscription_lastOrderId_key" ON "MembershipSubscription"("lastOrderId");
CREATE UNIQUE INDEX "MembershipSubscription_userId_tier_key" ON "MembershipSubscription"("userId", "tier");
CREATE INDEX "MembershipSubscription_userId_status_expiresAt_idx" ON "MembershipSubscription"("userId", "status", "expiresAt");
CREATE INDEX "MembershipSubscription_status_expiresAt_idx" ON "MembershipSubscription"("status", "expiresAt");
CREATE INDEX "MembershipSubscription_productId_status_idx" ON "MembershipSubscription"("productId", "status");
CREATE INDEX "MembershipSubscription_skuId_idx" ON "MembershipSubscription"("skuId");

ALTER TABLE "MembershipSubscription"
  ADD CONSTRAINT "MembershipSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipSubscription"
  ADD CONSTRAINT "MembershipSubscription_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipSubscription"
  ADD CONSTRAINT "MembershipSubscription_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MembershipSubscription"
  ADD CONSTRAINT "MembershipSubscription_lastOrderId_fkey"
  FOREIGN KEY ("lastOrderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
