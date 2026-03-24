CREATE TYPE "DiscussionPostType" AS ENUM (
  'problem_discussion',
  'solution',
  'contest_discussion',
  'question',
  'experience',
  'feedback',
  'announcement',
  'general'
);

CREATE TYPE "DiscussionAuditStatus" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'manual_review'
);

CREATE TYPE "DiscussionDisplayStatus" AS ENUM (
  'visible',
  'hidden',
  'shadow_hidden'
);

CREATE TYPE "DiscussionPublishStatus" AS ENUM (
  'immediate',
  'scheduled',
  'delayed_by_contest'
);

CREATE TYPE "DiscussionPinScope" AS ENUM (
  'none',
  'global',
  'problem',
  'contest',
  'category'
);

CREATE TYPE "DiscussionTagType" AS ENUM (
  'topic',
  'algorithm',
  'language',
  'official'
);

CREATE TYPE "DiscussionTagStatus" AS ENUM (
  'active',
  'disabled'
);

CREATE TYPE "DiscussionTargetType" AS ENUM (
  'post',
  'comment'
);

CREATE TYPE "DiscussionReportReasonCode" AS ENUM (
  'spoiler',
  'advertisement',
  'abuse',
  'plagiarism',
  'flood',
  'illegal_content',
  'other'
);

CREATE TYPE "DiscussionReportStatus" AS ENUM (
  'pending',
  'processing',
  'accepted',
  'rejected',
  'closed'
);

CREATE TYPE "DiscussionModerationActionType" AS ENUM (
  'approve',
  'reject',
  'hide',
  'unhide',
  'lock',
  'unlock',
  'pin',
  'unpin',
  'feature',
  'unfeature',
  'recommend',
  'unrecommend',
  'delete',
  'restore',
  'mark_best_comment',
  'mark_solved',
  'unmark_solved'
);

CREATE TABLE "DiscussionPost" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "postType" "DiscussionPostType" NOT NULL,
  "title" TEXT NOT NULL,
  "contentMarkdown" TEXT NOT NULL,
  "contentHtml" TEXT,
  "contentPlain" TEXT,
  "excerpt" TEXT,
  "problemId" TEXT,
  "contestId" TEXT,
  "bestCommentId" TEXT,
  "acceptedById" TEXT,
  "auditStatus" "DiscussionAuditStatus" NOT NULL DEFAULT 'pending',
  "displayStatus" "DiscussionDisplayStatus" NOT NULL DEFAULT 'visible',
  "publishStatus" "DiscussionPublishStatus" NOT NULL DEFAULT 'immediate',
  "publishAt" TIMESTAMP(3),
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "pinScope" "DiscussionPinScope" NOT NULL DEFAULT 'none',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isRecommended" BOOLEAN NOT NULL DEFAULT false,
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "isSolved" BOOLEAN NOT NULL DEFAULT false,
  "solvedAt" TIMESTAMP(3),
  "riskLevel" INTEGER NOT NULL DEFAULT 0,
  "riskFlags" JSONB,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "favoriteCount" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "hotScore" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "lastCommentAt" TIMESTAMP(3),
  "lastCommentUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "rootCommentId" TEXT,
  "parentCommentId" TEXT,
  "replyToUserId" TEXT,
  "contentMarkdown" TEXT NOT NULL,
  "contentHtml" TEXT,
  "contentPlain" TEXT,
  "depth" INTEGER NOT NULL DEFAULT 1,
  "floorNo" INTEGER NOT NULL DEFAULT 0,
  "auditStatus" "DiscussionAuditStatus" NOT NULL DEFAULT 'approved',
  "displayStatus" "DiscussionDisplayStatus" NOT NULL DEFAULT 'visible',
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "deletedBy" TEXT,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "riskLevel" INTEGER NOT NULL DEFAULT 0,
  "riskFlags" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionTag" (
  "id" TEXT NOT NULL,
  "tagName" TEXT NOT NULL,
  "tagSlug" TEXT NOT NULL,
  "tagType" "DiscussionTagType" NOT NULL DEFAULT 'topic',
  "status" "DiscussionTagStatus" NOT NULL DEFAULT 'active',
  "postCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionPostTag" (
  "postId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPostTag_pkey" PRIMARY KEY ("postId","tagId")
);

CREATE TABLE "DiscussionPostLike" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPostLike_pkey" PRIMARY KEY ("postId","userId")
);

CREATE TABLE "DiscussionCommentLike" (
  "commentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionCommentLike_pkey" PRIMARY KEY ("commentId","userId")
);

CREATE TABLE "DiscussionPostFavorite" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPostFavorite_pkey" PRIMARY KEY ("postId","userId")
);

CREATE TABLE "DiscussionReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "DiscussionTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "reasonCode" "DiscussionReportReasonCode" NOT NULL,
  "reasonText" TEXT,
  "evidenceJson" JSONB,
  "status" "DiscussionReportStatus" NOT NULL DEFAULT 'pending',
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "resultNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionAuditLog" (
  "id" TEXT NOT NULL,
  "targetType" "DiscussionTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "auditStatus" "DiscussionAuditStatus" NOT NULL,
  "operatorId" TEXT,
  "reason" TEXT,
  "snapshotJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionModerationAction" (
  "id" TEXT NOT NULL,
  "targetType" "DiscussionTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "actionType" "DiscussionModerationActionType" NOT NULL,
  "operatorId" TEXT NOT NULL,
  "reason" TEXT,
  "extraJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscussionTag_tagName_key" ON "DiscussionTag"("tagName");
CREATE UNIQUE INDEX "DiscussionTag_tagSlug_key" ON "DiscussionTag"("tagSlug");
CREATE UNIQUE INDEX "DiscussionReport_reporterId_targetType_targetId_key" ON "DiscussionReport"("reporterId","targetType","targetId");

CREATE INDEX "DiscussionPost_authorId_createdAt_idx" ON "DiscussionPost"("authorId","createdAt");
CREATE INDEX "DiscussionPost_problemId_auditStatus_displayStatus_publishAt_createdAt_idx" ON "DiscussionPost"("problemId","auditStatus","displayStatus","publishAt","createdAt");
CREATE INDEX "DiscussionPost_contestId_auditStatus_displayStatus_publishAt_createdAt_idx" ON "DiscussionPost"("contestId","auditStatus","displayStatus","publishAt","createdAt");
CREATE INDEX "DiscussionPost_postType_auditStatus_displayStatus_publishAt_createdAt_idx" ON "DiscussionPost"("postType","auditStatus","displayStatus","publishAt","createdAt");
CREATE INDEX "DiscussionPost_publishStatus_publishAt_idx" ON "DiscussionPost"("publishStatus","publishAt");
CREATE INDEX "DiscussionPost_isPinned_isFeatured_isRecommended_createdAt_idx" ON "DiscussionPost"("isPinned","isFeatured","isRecommended","createdAt");
CREATE INDEX "DiscussionPost_displayStatus_auditStatus_publishAt_hotScore_idx" ON "DiscussionPost"("displayStatus","auditStatus","publishAt","hotScore");
CREATE INDEX "DiscussionPost_postType_isSolved_lastCommentAt_createdAt_idx" ON "DiscussionPost"("postType","isSolved","lastCommentAt","createdAt");
CREATE INDEX "DiscussionPost_lastCommentAt_idx" ON "DiscussionPost"("lastCommentAt");

CREATE INDEX "DiscussionComment_postId_rootCommentId_depth_createdAt_idx" ON "DiscussionComment"("postId","rootCommentId","depth","createdAt");
CREATE INDEX "DiscussionComment_parentCommentId_createdAt_idx" ON "DiscussionComment"("parentCommentId","createdAt");
CREATE INDEX "DiscussionComment_postId_auditStatus_displayStatus_isDeleted_createdAt_idx" ON "DiscussionComment"("postId","auditStatus","displayStatus","isDeleted","createdAt");
CREATE INDEX "DiscussionComment_authorId_createdAt_idx" ON "DiscussionComment"("authorId","createdAt");

CREATE INDEX "DiscussionTag_tagType_postCount_idx" ON "DiscussionTag"("tagType","postCount");
CREATE INDEX "DiscussionTag_status_postCount_idx" ON "DiscussionTag"("status","postCount");
CREATE INDEX "DiscussionPostTag_tagId_postId_idx" ON "DiscussionPostTag"("tagId","postId");
CREATE INDEX "DiscussionPostLike_userId_createdAt_idx" ON "DiscussionPostLike"("userId","createdAt");
CREATE INDEX "DiscussionPostLike_postId_createdAt_idx" ON "DiscussionPostLike"("postId","createdAt");
CREATE INDEX "DiscussionCommentLike_userId_createdAt_idx" ON "DiscussionCommentLike"("userId","createdAt");
CREATE INDEX "DiscussionCommentLike_commentId_createdAt_idx" ON "DiscussionCommentLike"("commentId","createdAt");
CREATE INDEX "DiscussionPostFavorite_userId_createdAt_idx" ON "DiscussionPostFavorite"("userId","createdAt");
CREATE INDEX "DiscussionPostFavorite_postId_createdAt_idx" ON "DiscussionPostFavorite"("postId","createdAt");
CREATE INDEX "DiscussionReport_targetType_targetId_status_createdAt_idx" ON "DiscussionReport"("targetType","targetId","status","createdAt");
CREATE INDEX "DiscussionReport_status_createdAt_idx" ON "DiscussionReport"("status","createdAt");
CREATE INDEX "DiscussionReport_reporterId_createdAt_idx" ON "DiscussionReport"("reporterId","createdAt");
CREATE INDEX "DiscussionAuditLog_targetType_targetId_createdAt_idx" ON "DiscussionAuditLog"("targetType","targetId","createdAt");
CREATE INDEX "DiscussionAuditLog_operatorId_createdAt_idx" ON "DiscussionAuditLog"("operatorId","createdAt");
CREATE INDEX "DiscussionAuditLog_auditStatus_createdAt_idx" ON "DiscussionAuditLog"("auditStatus","createdAt");
CREATE INDEX "DiscussionModerationAction_targetType_targetId_createdAt_idx" ON "DiscussionModerationAction"("targetType","targetId","createdAt");
CREATE INDEX "DiscussionModerationAction_operatorId_createdAt_idx" ON "DiscussionModerationAction"("operatorId","createdAt");
CREATE INDEX "DiscussionModerationAction_actionType_createdAt_idx" ON "DiscussionModerationAction"("actionType","createdAt");

ALTER TABLE "DiscussionPost"
  ADD CONSTRAINT "DiscussionPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscussionPost"
  ADD CONSTRAINT "DiscussionPost_problemId_fkey"
  FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscussionPost"
  ADD CONSTRAINT "DiscussionPost_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscussionComment"
  ADD CONSTRAINT "DiscussionComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionComment"
  ADD CONSTRAINT "DiscussionComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscussionPostTag"
  ADD CONSTRAINT "DiscussionPostTag_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionPostTag"
  ADD CONSTRAINT "DiscussionPostTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "DiscussionTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionPostLike"
  ADD CONSTRAINT "DiscussionPostLike_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionCommentLike"
  ADD CONSTRAINT "DiscussionCommentLike_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "DiscussionComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscussionPostFavorite"
  ADD CONSTRAINT "DiscussionPostFavorite_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
