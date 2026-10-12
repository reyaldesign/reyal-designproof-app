-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "device" TEXT;
ALTER TABLE "Comment" ADD COLUMN "elementText" TEXT;
ALTER TABLE "Comment" ADD COLUMN "pageUrl" TEXT;
ALTER TABLE "Comment" ADD COLUMN "rx" REAL;
ALTER TABLE "Comment" ADD COLUMN "ry" REAL;
ALTER TABLE "Comment" ADD COLUMN "selector" TEXT;
ALTER TABLE "Comment" ADD COLUMN "shot" TEXT;
ALTER TABLE "Comment" ADD COLUMN "vw" INTEGER;

-- AlterTable
ALTER TABLE "Version" ADD COLUMN "liveUrl" TEXT;
