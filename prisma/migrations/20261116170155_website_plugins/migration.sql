-- AlterTable
ALTER TABLE "Website" ADD COLUMN "pluginsAt" DATETIME;

-- CreateTable
CREATE TABLE "WebsitePlugin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updateVersion" TEXT,
    CONSTRAINT "WebsitePlugin_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePlugin_websiteId_slug_key" ON "WebsitePlugin"("websiteId", "slug");
