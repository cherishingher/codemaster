ALTER TABLE "User"
  ADD COLUMN "pointsBalance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Post"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'discussion',
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "StudyGroup" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT,
  "description" TEXT,
  "topic" TEXT,
  "level" TEXT NOT NULL DEFAULT 'mixed',
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "status" TEXT NOT NULL DEFAULT 'active',
  "memberLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudyGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "actionKey" TEXT,
  "pointsDelta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "relatedType" TEXT,
  "relatedId" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyGroup_slug_key"
  ON "StudyGroup"("slug");

CREATE INDEX "StudyGroup_status_visibility_createdAt_idx"
  ON "StudyGroup"("status", "visibility", "createdAt");

CREATE INDEX "StudyGroup_ownerId_createdAt_idx"
  ON "StudyGroup"("ownerId", "createdAt");

CREATE UNIQUE INDEX "StudyGroupMember_groupId_userId_key"
  ON "StudyGroupMember"("groupId", "userId");

CREATE INDEX "StudyGroupMember_userId_status_createdAt_idx"
  ON "StudyGroupMember"("userId", "status", "createdAt");

CREATE INDEX "StudyGroupMember_groupId_role_status_joinedAt_idx"
  ON "StudyGroupMember"("groupId", "role", "status", "joinedAt");

CREATE UNIQUE INDEX "PointTransaction_actionKey_key"
  ON "PointTransaction"("actionKey");

CREATE INDEX "PointTransaction_userId_createdAt_idx"
  ON "PointTransaction"("userId", "createdAt");

CREATE INDEX "PointTransaction_actionType_createdAt_idx"
  ON "PointTransaction"("actionType", "createdAt");

CREATE INDEX "PointRedemption_userId_createdAt_idx"
  ON "PointRedemption"("userId", "createdAt");

CREATE INDEX "PointRedemption_productId_status_createdAt_idx"
  ON "PointRedemption"("productId", "status", "createdAt");

CREATE INDEX "Post_kind_status_createdAt_idx"
  ON "Post"("kind", "status", "createdAt");

CREATE INDEX "Post_groupId_status_createdAt_idx"
  ON "Post"("groupId", "status", "createdAt");

ALTER TABLE "StudyGroup"
  ADD CONSTRAINT "StudyGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudyGroupMember"
  ADD CONSTRAINT "StudyGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudyGroupMember"
  ADD CONSTRAINT "StudyGroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointRedemption"
  ADD CONSTRAINT "PointRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PointRedemption"
  ADD CONSTRAINT "PointRedemption_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
