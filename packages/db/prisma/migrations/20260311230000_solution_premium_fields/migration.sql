ALTER TABLE "Solution"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "accessLevel" TEXT,
  ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Solution"
SET
  "accessLevel" = CASE
    WHEN lower("visibility") IN ('public', 'free') THEN 'FREE'
    WHEN lower("visibility") IN ('vip', 'member', 'membership') THEN 'MEMBERSHIP'
    WHEN lower("visibility") IN ('purchase', 'paid') THEN 'PURCHASE'
    WHEN lower("visibility") IN ('protected', 'member_or_purchase') THEN 'MEMBERSHIP_OR_PURCHASE'
    ELSE NULL
  END,
  "isPremium" = CASE
    WHEN lower("visibility") IN ('vip', 'member', 'membership', 'purchase', 'paid', 'protected', 'member_or_purchase') THEN true
    ELSE false
  END
WHERE "accessLevel" IS NULL;

CREATE INDEX "Solution_problemId_accessLevel_createdAt_idx"
  ON "Solution"("problemId", "accessLevel", "createdAt");
