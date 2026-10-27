-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Live',
    "server" TEXT NOT NULL DEFAULT '',
    "captcha" TEXT NOT NULL DEFAULT '',
    "backup" TEXT NOT NULL DEFAULT '',
    "forwardLinks" TEXT NOT NULL DEFAULT '',
    "backupTime" TEXT NOT NULL DEFAULT '',
    "maintenanceCheck" TEXT NOT NULL DEFAULT '',
    "desktopStatus" TEXT NOT NULL DEFAULT '',
    "mobileStatus" TEXT NOT NULL DEFAULT '',
    "seo" TEXT NOT NULL DEFAULT '',
    "formSubmission" TEXT NOT NULL DEFAULT '',
    "emailUsed" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebsiteCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "code" INTEGER,
    "ms" INTEGER,
    "error" TEXT,
    CONSTRAINT "WebsiteCheck_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WebsiteCheck_websiteId_at_idx" ON "WebsiteCheck"("websiteId", "at");

-- CreateIndex
CREATE INDEX "WebsiteCheck_at_idx" ON "WebsiteCheck"("at");

-- Admins and Project Managers get the Websites tool to start with. Anyone else can be given it under Team & access.
INSERT OR IGNORE INTO "RolePermission" ("role","tool") VALUES ('ADMIN','WEBSITES'),('PM','WEBSITES');
