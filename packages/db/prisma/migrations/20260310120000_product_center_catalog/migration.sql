ALTER TABLE "Product"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CNY',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tags" JSONB,
  ADD COLUMN "targetType" TEXT,
  ADD COLUMN "targetId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_sortOrder_idx" ON "Product"("status", "sortOrder");
CREATE INDEX "Product_type_status_sortOrder_idx" ON "Product"("type", "status", "sortOrder");
CREATE INDEX "Product_targetType_targetId_idx" ON "Product"("targetType", "targetId");

CREATE TABLE "ProductSku" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "skuCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL,
  "originalPriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'CNY',
  "validDays" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductSku_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductSku_productId_skuCode_key"
  ON "ProductSku"("productId", "skuCode");

CREATE INDEX "ProductSku_productId_status_sortOrder_idx"
  ON "ProductSku"("productId", "status", "sortOrder");

ALTER TABLE "ProductSku"
  ADD CONSTRAINT "ProductSku_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductBenefit" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "benefitType" TEXT NOT NULL DEFAULT 'text',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductBenefit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductBenefit_productId_sortOrder_idx"
  ON "ProductBenefit"("productId", "sortOrder");

ALTER TABLE "ProductBenefit"
  ADD CONSTRAINT "ProductBenefit_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
