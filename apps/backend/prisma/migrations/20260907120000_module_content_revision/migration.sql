ALTER TABLE "Module" ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 1;

-- Existing summaries may predate source deletion or re-extraction.
UPDATE "Topic" SET "contentRevision" = "contentRevision" + 1,
  "summary" = NULL, "summaryRevision" = NULL;
