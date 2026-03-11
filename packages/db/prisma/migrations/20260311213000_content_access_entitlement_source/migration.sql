ALTER TABLE "Entitlement"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'PURCHASE',
  ADD COLUMN "sourceId" TEXT;

UPDATE "Entitlement"
SET "sourceType" = 'PURCHASE'
WHERE "sourceType" IS NULL;

CREATE INDEX "Entitlement_userId_sourceType_expiresAt_idx"
  ON "Entitlement"("userId", "sourceType", "expiresAt");

CREATE INDEX "Entitlement_sourceType_sourceId_idx"
  ON "Entitlement"("sourceType", "sourceId");
