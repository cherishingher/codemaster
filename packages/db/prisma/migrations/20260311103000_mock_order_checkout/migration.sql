ALTER TABLE "Order"
  ADD COLUMN "skuId" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CNY',
  ADD COLUMN "productNameSnapshot" TEXT,
  ADD COLUMN "skuNameSnapshot" TEXT,
  ADD COLUMN "validDaysSnapshot" INTEGER,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Order_userId_status_createdAt_idx"
  ON "Order"("userId", "status", "createdAt");

CREATE INDEX "Order_skuId_createdAt_idx"
  ON "Order"("skuId", "createdAt");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD COLUMN "amountCents" INTEGER,
  ADD COLUMN "tradeNo" TEXT,
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Payment_status_createdAt_idx"
  ON "Payment"("status", "createdAt");
