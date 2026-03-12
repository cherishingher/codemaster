ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "skuId" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "productNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "skuNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "validDaysSnapshot" INTEGER,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "orderNo" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundProcessedAt" TIMESTAMP(3);

UPDATE "Order"
SET "currency" = COALESCE("currency", 'CNY'),
    "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "currency" IS NULL OR "updatedAt" IS NULL;

UPDATE "Order"
SET "orderNo" = 'ORD_' || TO_CHAR(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING("id", 1, 8)
WHERE "orderNo" IS NULL;

ALTER TABLE "Order"
  ALTER COLUMN "currency" SET DEFAULT 'CNY',
  ALTER COLUMN "status" SET DEFAULT 'CREATED',
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "orderNo" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNo_key" ON "Order"("orderNo");
CREATE INDEX IF NOT EXISTS "Order_userId_status_createdAt_idx" ON "Order"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_skuId_createdAt_idx" ON "Order"("skuId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_skuId_fkey') THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_skuId_fkey"
      FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "amountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "tradeNo" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentNo" TEXT,
  ADD COLUMN IF NOT EXISTS "callbackPayload" JSONB,
  ADD COLUMN IF NOT EXISTS "callbackAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "entitlementGrantedAt" TIMESTAMP(3);

UPDATE "Payment"
SET "createdAt" = COALESCE("createdAt", "paidAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", "paidAt", "createdAt", CURRENT_TIMESTAMP),
    "channel" = COALESCE(NULLIF("channel", ''), 'MOCK'),
    "status" = COALESCE(NULLIF("status", ''), 'PENDING')
WHERE "createdAt" IS NULL
   OR "updatedAt" IS NULL
   OR "channel" IS NULL
   OR "channel" = ''
   OR "status" IS NULL
   OR "status" = '';

UPDATE "Payment"
SET "paymentNo" = 'PAY_' || TO_CHAR(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING("id", 1, 8)
WHERE "paymentNo" IS NULL;

ALTER TABLE "Payment"
  ALTER COLUMN "channel" SET DEFAULT 'MOCK',
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "paymentNo" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_paymentNo_key" ON "Payment"("paymentNo");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_orderId_status_createdAt_idx" ON "Payment"("orderId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id" TEXT NOT NULL,
  "refundNo" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "reason" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RefundRequest"
  ADD COLUMN IF NOT EXISTS "refundNo" TEXT,
  ADD COLUMN IF NOT EXISTS "orderId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'CREATED',
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "note" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "RefundRequest"
SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "RefundRequest"
  ALTER COLUMN "status" SET DEFAULT 'CREATED',
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "RefundRequest_refundNo_key" ON "RefundRequest"("refundNo");
CREATE UNIQUE INDEX IF NOT EXISTS "RefundRequest_orderId_key" ON "RefundRequest"("orderId");
CREATE INDEX IF NOT EXISTS "RefundRequest_userId_status_createdAt_idx" ON "RefundRequest"("userId", "status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_orderId_fkey') THEN
    ALTER TABLE "RefundRequest"
      ADD CONSTRAINT "RefundRequest_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_userId_fkey') THEN
    ALTER TABLE "RefundRequest"
      ADD CONSTRAINT "RefundRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MembershipSubscription" (
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

ALTER TABLE "MembershipSubscription"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "productId" TEXT,
  ADD COLUMN IF NOT EXISTS "skuId" TEXT,
  ADD COLUMN IF NOT EXISTS "tier" TEXT DEFAULT 'VIP',
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "MembershipSubscription"
SET "tier" = COALESCE("tier", 'VIP'),
    "status" = COALESCE("status", 'ACTIVE'),
    "startedAt" = COALESCE("startedAt", "createdAt", CURRENT_TIMESTAMP),
    "expiresAt" = COALESCE("expiresAt", CURRENT_TIMESTAMP + INTERVAL '30 days'),
    "createdAt" = COALESCE("createdAt", "startedAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "tier" IS NULL
   OR "status" IS NULL
   OR "startedAt" IS NULL
   OR "expiresAt" IS NULL
   OR "createdAt" IS NULL
   OR "updatedAt" IS NULL;

ALTER TABLE "MembershipSubscription"
  ALTER COLUMN "tier" SET DEFAULT 'VIP',
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "startedAt" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "MembershipSubscription_lastOrderId_key" ON "MembershipSubscription"("lastOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipSubscription_userId_tier_key" ON "MembershipSubscription"("userId", "tier");
CREATE INDEX IF NOT EXISTS "MembershipSubscription_userId_status_expiresAt_idx" ON "MembershipSubscription"("userId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "MembershipSubscription_status_expiresAt_idx" ON "MembershipSubscription"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "MembershipSubscription_productId_status_idx" ON "MembershipSubscription"("productId", "status");
CREATE INDEX IF NOT EXISTS "MembershipSubscription_skuId_idx" ON "MembershipSubscription"("skuId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MembershipSubscription_userId_fkey') THEN
    ALTER TABLE "MembershipSubscription"
      ADD CONSTRAINT "MembershipSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MembershipSubscription_productId_fkey') THEN
    ALTER TABLE "MembershipSubscription"
      ADD CONSTRAINT "MembershipSubscription_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MembershipSubscription_skuId_fkey') THEN
    ALTER TABLE "MembershipSubscription"
      ADD CONSTRAINT "MembershipSubscription_skuId_fkey"
      FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MembershipSubscription_lastOrderId_fkey') THEN
    ALTER TABLE "MembershipSubscription"
      ADD CONSTRAINT "MembershipSubscription_lastOrderId_fkey"
      FOREIGN KEY ("lastOrderId") REFERENCES "Order"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
