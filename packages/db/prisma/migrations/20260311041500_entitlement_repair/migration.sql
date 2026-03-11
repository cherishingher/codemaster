ALTER TABLE "Entitlement"
  ADD COLUMN IF NOT EXISTS "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "Entitlement_userId_productId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_userId_productId_key"
  ON "Entitlement"("userId", "productId");

CREATE INDEX IF NOT EXISTS "Entitlement_userId_expiresAt_idx"
  ON "Entitlement"("userId", "expiresAt");
