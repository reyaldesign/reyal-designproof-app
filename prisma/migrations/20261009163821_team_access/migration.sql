-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignInAt" DATETIME
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL,
    "tool" TEXT NOT NULL,

    PRIMARY KEY ("role", "tool")
);

-- CreateTable
CREATE TABLE "UserToolOverride" (
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    PRIMARY KEY ("userId", "tool"),
    CONSTRAINT "UserToolOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignInEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "actor" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "SignInEvent_at_idx" ON "SignInEvent"("at");

-- Default role grid (editable on the Team & access page).
INSERT INTO "RolePermission" ("role","tool") VALUES
 ('ADMIN','PROOFS'),('ADMIN','REQUESTS'),('ADMIN','AI_REVIEW'),('ADMIN','AI_CRITERIA'),('ADMIN','TEAM'),
 ('PM','PROOFS'),('PM','REQUESTS'),
 ('DESIGNER','AI_REVIEW');

-- First admin besides ADMIN_EMAIL, so the team can be approved from day one.
INSERT OR IGNORE INTO "User" ("id","email","name","role","status") VALUES ('seed-creyes','creyes@reyaldesign.com','','ADMIN','ACTIVE');
