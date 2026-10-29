-- CreateTable
CREATE TABLE "StackCost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Plugin',
    "cost" REAL,
    "term" INTEGER NOT NULL DEFAULT 1,
    "termUnit" TEXT NOT NULL DEFAULT 'yr',
    "renewal" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Admins get the new tool. Other roles get it from Team & access.
INSERT OR IGNORE INTO "RolePermission" ("role", "tool") VALUES ('ADMIN', 'COSTS');

-- The items tracked so far, imported once from the Reyal Stack Costs sheet.
INSERT INTO "StackCost" ("id","name","vendor","category","cost","term","termUnit","renewal","plan","notes","updatedAt") VALUES
 ('aio-wp-migration','All-in-One WP Migration','ServMask','Backup',69,1,'yr','2026-11-26','','Wordpress Backup/Restore Plugin',CURRENT_TIMESTAMP),
 ('dreamhost-vps','VPS 4GB RAM/120GB - VPS53108','DreamHost','Hosting',1440,3,'yr','2026-11-10','','3-years Sub. Started on 2023-11-10',CURRENT_TIMESTAMP),
 ('elementor-pro','Elementor Pro - Agency','Elementor','Plugin',399,1,'yr','2026-11-26','1000','Subscription ID 14208984',CURRENT_TIMESTAMP),
 ('jtljy5gyfsjcxi5ryyg4','VPS - Stack 16','Dreamhost','Hosting',371.76,2,'yr','2028-08-31','','Started on 2026-08-31',CURRENT_TIMESTAMP),
 ('search-atlas','Search Atlas','Search Atlas','SEO',3351.6,1,'yr','2027-07-29','','',CURRENT_TIMESTAMP),
 ('wlny91xbx3e6vcow3d7o','VPS 8GB RAM/240GB - VPS54387','Dreamhost','Hosting',2880,3,'yr','2027-01-25','','3-years Sub. Started on 2024-01-25',CURRENT_TIMESTAMP);
