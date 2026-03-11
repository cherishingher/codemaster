ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "type" TEXT NOT NULL DEFAULT 'institution',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "description" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMember" (
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("organizationId","userId")
);

CREATE TABLE "TeacherProfile" (
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "displayName" TEXT,
  "title" TEXT,
  "bio" TEXT,
  "specialties" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "TeachingGroup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "ownerId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "groupType" TEXT NOT NULL DEFAULT 'class',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "summary" TEXT,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingGroupMember" (
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "memberRole" TEXT NOT NULL DEFAULT 'student',
  "status" TEXT NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

ALTER TABLE "CampClass"
  ADD COLUMN IF NOT EXISTS "teachingGroupId" TEXT;

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "TeachingGroup_slug_key" ON "TeachingGroup"("slug");
CREATE INDEX "Organization_type_status_createdAt_idx" ON "Organization"("type", "status", "createdAt");
CREATE INDEX "Organization_status_createdAt_idx" ON "Organization"("status", "createdAt");
CREATE INDEX "OrganizationMember_userId_status_createdAt_idx" ON "OrganizationMember"("userId", "status", "createdAt");
CREATE INDEX "OrganizationMember_organizationId_role_status_idx" ON "OrganizationMember"("organizationId", "role", "status");
CREATE INDEX "TeacherProfile_organizationId_status_createdAt_idx" ON "TeacherProfile"("organizationId", "status", "createdAt");
CREATE INDEX "TeachingGroup_organizationId_status_createdAt_idx" ON "TeachingGroup"("organizationId", "status", "createdAt");
CREATE INDEX "TeachingGroup_ownerId_status_createdAt_idx" ON "TeachingGroup"("ownerId", "status", "createdAt");
CREATE INDEX "TeachingGroupMember_userId_memberRole_status_createdAt_idx" ON "TeachingGroupMember"("userId", "memberRole", "status", "createdAt");
CREATE INDEX "TeachingGroupMember_groupId_memberRole_status_idx" ON "TeachingGroupMember"("groupId", "memberRole", "status");
CREATE INDEX "CampClass_teachingGroupId_idx" ON "CampClass"("teachingGroupId");

ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherProfile"
  ADD CONSTRAINT "TeacherProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherProfile"
  ADD CONSTRAINT "TeacherProfile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeachingGroup"
  ADD CONSTRAINT "TeachingGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TeachingGroup"
  ADD CONSTRAINT "TeachingGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingGroupMember"
  ADD CONSTRAINT "TeachingGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeachingGroupMember"
  ADD CONSTRAINT "TeachingGroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampClass"
  ADD CONSTRAINT "CampClass_teachingGroupId_fkey"
  FOREIGN KEY ("teachingGroupId") REFERENCES "TeachingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
