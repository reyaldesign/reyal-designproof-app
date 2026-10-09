-- CreateTable
CREATE TABLE "AiClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiCategory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AiClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiCriterion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AiClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiCriterion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AiCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "clientName" TEXT,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "originalFilename" TEXT NOT NULL,
    "imageFile" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "actionItems" TEXT NOT NULL DEFAULT '[]',
    "checks" TEXT NOT NULL DEFAULT '[]',
    "criteriaSnapshot" TEXT NOT NULL DEFAULT '[]',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AiClient" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiReview_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AiCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiReview_createdAt_idx" ON "AiReview"("createdAt");
