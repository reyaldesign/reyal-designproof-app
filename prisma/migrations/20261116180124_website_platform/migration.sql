-- A column added on the end of the table, so the existing rows and the tables that point at Website are left as they are.
ALTER TABLE "Website" ADD COLUMN "platform" TEXT NOT NULL DEFAULT '';
