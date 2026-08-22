CREATE TABLE "TopicEvidenceProvenance" (
    "id" TEXT NOT NULL,
    "analysisChunkId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "topicEvidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicEvidenceProvenance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopicEvidenceProvenance_topicEvidenceId_analysisChunkId_key"
ON "TopicEvidenceProvenance"("topicEvidenceId", "analysisChunkId");

CREATE INDEX "TopicEvidenceProvenance_analysisChunkId_idx"
ON "TopicEvidenceProvenance"("analysisChunkId");

CREATE INDEX "TopicEvidenceProvenance_sourceId_idx"
ON "TopicEvidenceProvenance"("sourceId");

CREATE INDEX "TopicEvidenceProvenance_sourcePageId_idx"
ON "TopicEvidenceProvenance"("sourcePageId");

ALTER TABLE "TopicEvidenceProvenance"
ADD CONSTRAINT "TopicEvidenceProvenance_topicEvidenceId_fkey"
FOREIGN KEY ("topicEvidenceId") REFERENCES "TopicEvidence"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
