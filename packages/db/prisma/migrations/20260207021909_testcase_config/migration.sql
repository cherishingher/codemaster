-- AlterTable
ALTER TABLE "Testcase" ADD COLUMN     "isPretest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memoryLimitKb" INTEGER,
ADD COLUMN     "subtaskId" INTEGER,
ADD COLUMN     "timeLimitMs" INTEGER;
