ALTER TABLE "Order"
  ADD COLUMN "orderNo" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedReason" TEXT,
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundProcessedAt" TIMESTAMP(3);

UPDATE "Order"
SET "orderNo" = 'ORD_' || TO_CHAR(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING("id", 1, 8)
WHERE "orderNo" IS NULL;

UPDATE "Order"
SET "status" = CASE UPPER("status")
  WHEN 'CREATED' THEN 'CREATED'
  WHEN 'PENDING' THEN 'PENDING'
  WHEN 'PAID' THEN 'PAID'
  WHEN 'CLOSED' THEN 'CLOSED'
  WHEN 'REFUNDING' THEN 'REFUNDING'
  WHEN 'REFUNDED' THEN 'REFUNDED'
  ELSE CASE
    WHEN LOWER("status") = 'paid' THEN 'PAID'
    WHEN LOWER("status") = 'created' THEN 'CREATED'
    ELSE 'CREATED'
  END
END;

ALTER TABLE "Order"
  ALTER COLUMN "orderNo" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

ALTER TABLE "Payment"
  ADD COLUMN "paymentNo" TEXT,
  ADD COLUMN "callbackPayload" JSONB,
  ADD COLUMN "callbackAt" TIMESTAMP(3),
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "entitlementGrantedAt" TIMESTAMP(3);

UPDATE "Payment"
SET "paymentNo" = 'PAY_' || TO_CHAR(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING("id", 1, 8)
WHERE "paymentNo" IS NULL;

UPDATE "Payment"
SET "channel" = CASE
  WHEN UPPER(COALESCE("channel", '')) = 'MOCK' THEN 'MOCK'
  ELSE 'MOCK'
END;

UPDATE "Payment"
SET "status" = CASE UPPER("status")
  WHEN 'CREATED' THEN 'CREATED'
  WHEN 'PENDING' THEN 'PENDING'
  WHEN 'SUCCEEDED' THEN 'SUCCEEDED'
  WHEN 'FAILED' THEN 'FAILED'
  WHEN 'CLOSED' THEN 'CLOSED'
  ELSE CASE
    WHEN LOWER("status") = 'paid' THEN 'SUCCEEDED'
    WHEN LOWER("status") = 'created' THEN 'PENDING'
    ELSE 'PENDING'
  END
END;

ALTER TABLE "Payment"
  ALTER COLUMN "paymentNo" SET NOT NULL,
  ALTER COLUMN "channel" SET DEFAULT 'MOCK',
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX "Payment_paymentNo_key" ON "Payment"("paymentNo");
CREATE INDEX "Payment_orderId_status_createdAt_idx" ON "Payment"("orderId", "status", "createdAt");

CREATE TABLE "RefundRequest" (
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

CREATE UNIQUE INDEX "RefundRequest_refundNo_key" ON "RefundRequest"("refundNo");
CREATE UNIQUE INDEX "RefundRequest_orderId_key" ON "RefundRequest"("orderId");
CREATE INDEX "RefundRequest_userId_status_createdAt_idx" ON "RefundRequest"("userId", "status", "createdAt");

ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
