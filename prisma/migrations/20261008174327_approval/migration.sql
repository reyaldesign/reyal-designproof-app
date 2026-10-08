-- AlterTable
ALTER TABLE "Project" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Project" ADD COLUMN "approvedVersion" INTEGER;
