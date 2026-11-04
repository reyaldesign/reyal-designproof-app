-- Pages a client marked "Looks good" in a revision (JSON list). Additive.
ALTER TABLE "Submission" ADD COLUMN "marks" TEXT NOT NULL DEFAULT '[]';
