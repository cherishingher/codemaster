CREATE INDEX IF NOT EXISTS "UserProblemProgress_userId_solvedAt_idx"
ON "UserProblemProgress"("userId", "solvedAt");
