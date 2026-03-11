ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "externalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "settings" JSONB;

ALTER TABLE "TeachingGroup"
  ADD COLUMN IF NOT EXISTS "externalCode" TEXT;

CREATE TABLE "OrganizationApiKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_externalCode_key" ON "Organization"("externalCode");
CREATE UNIQUE INDEX "TeachingGroup_organizationId_externalCode_key" ON "TeachingGroup"("organizationId", "externalCode");
CREATE UNIQUE INDEX "OrganizationApiKey_tokenHash_key" ON "OrganizationApiKey"("tokenHash");
CREATE INDEX "OrganizationApiKey_organizationId_status_createdAt_idx" ON "OrganizationApiKey"("organizationId", "status", "createdAt");
CREATE INDEX "OrganizationApiKey_createdById_createdAt_idx" ON "OrganizationApiKey"("createdById", "createdAt");
CREATE INDEX "OrganizationApiKey_expiresAt_idx" ON "OrganizationApiKey"("expiresAt");

ALTER TABLE "OrganizationApiKey"
  ADD CONSTRAINT "OrganizationApiKey_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationApiKey"
  ADD CONSTRAINT "OrganizationApiKey_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
