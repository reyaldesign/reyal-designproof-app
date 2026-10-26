-- Figma prototype proofs. Additive only: nothing existing changes.
ALTER TABLE "Version" ADD COLUMN "figma" TEXT;
ALTER TABLE "Image" ADD COLUMN "frameId" TEXT;
ALTER TABLE "Image" ADD COLUMN "frameName" TEXT;
ALTER TABLE "Image" ADD COLUMN "device" TEXT;
ALTER TABLE "Image" ADD COLUMN "fw" INTEGER;
ALTER TABLE "Image" ADD COLUMN "fh" INTEGER;
ALTER TABLE "Comment" ADD COLUMN "figmaId" TEXT;
