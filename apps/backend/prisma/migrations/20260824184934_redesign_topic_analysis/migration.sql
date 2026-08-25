/*
  Warnings:

  - You are about to drop the column `status` on the `Source` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Source` table. All the data in the column will be lost.
  - You are about to drop the column `topicId` on the `TopicEvidence` table. All the data in the column will be lost.
  - You are about to drop the `SourcePage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TopicEvidenceProvenance` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sourceId,chunkIndex]` on the table `SourceChunk` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sourceTopicId` to the `TopicEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SourceProcessingStageType" AS ENUM ('CONVERSION', 'RAG_INDEXING', 'TOPIC_ANALYSIS');

-- CreateEnum
CREATE TYPE "ProcessingState" AS ENUM ('NOT_STARTED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "SourcePage" DROP CONSTRAINT "SourcePage_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "TopicEvidence" DROP CONSTRAINT "TopicEvidence_topicId_fkey";

-- DropForeignKey
ALTER TABLE "TopicEvidenceProvenance" DROP CONSTRAINT "TopicEvidenceProvenance_topicEvidenceId_fkey";

-- DropIndex
DROP INDEX "Source_status_idx";

-- DropIndex
DROP INDEX "TopicEvidence_topicId_idx";

-- AlterTable
ALTER TABLE "Source" DROP COLUMN "status",
DROP COLUMN "type",
ADD COLUMN     "doclang" TEXT,
ADD COLUMN     "doclingVersion" TEXT;

-- AlterTable
ALTER TABLE "SourceChunk" ADD COLUMN     "endRef" TEXT,
ADD COLUMN     "headingPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "startRef" TEXT,
ADD COLUMN     "tokenCount" INTEGER;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "summaryRevision" INTEGER;

-- AlterTable
ALTER TABLE "TopicEvidence" DROP COLUMN "topicId",
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "sourceTopicId" TEXT NOT NULL;

-- DropTable
DROP TABLE "SourcePage";

-- DropTable
DROP TABLE "TopicEvidenceProvenance";

-- DropEnum
DROP TYPE "SourceStatus";

-- DropEnum
DROP TYPE "SourceType";

-- CreateTable
CREATE TABLE "SourceProcessingStage" (
    "id" TEXT NOT NULL,
    "stage" "SourceProcessingStageType" NOT NULL,
    "state" "ProcessingState" NOT NULL DEFAULT 'NOT_STARTED',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceProcessingStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceTopic" (
    "id" TEXT NOT NULL,
    "spanIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectionConfidence" DOUBLE PRECISION,
    "canonicalizationConfidence" DOUBLE PRECISION,
    "startRef" TEXT,
    "endRef" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "sourceId" TEXT NOT NULL,
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicEvidenceSpan" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "startRef" TEXT,
    "endRef" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "topicEvidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicEvidenceSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceProcessingStage_state_idx" ON "SourceProcessingStage"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SourceProcessingStage_sourceId_stage_key" ON "SourceProcessingStage"("sourceId", "stage");

-- CreateIndex
CREATE INDEX "SourceTopic_sourceId_idx" ON "SourceTopic"("sourceId");

-- CreateIndex
CREATE INDEX "SourceTopic_topicId_idx" ON "SourceTopic"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceTopic_sourceId_spanIndex_key" ON "SourceTopic"("sourceId", "spanIndex");

-- CreateIndex
CREATE INDEX "TopicEvidenceSpan_topicEvidenceId_idx" ON "TopicEvidenceSpan"("topicEvidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceChunk_sourceId_chunkIndex_key" ON "SourceChunk"("sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "TopicEvidence_sourceTopicId_idx" ON "TopicEvidence"("sourceTopicId");

-- AddForeignKey
ALTER TABLE "SourceProcessingStage" ADD CONSTRAINT "SourceProcessingStage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceTopic" ADD CONSTRAINT "SourceTopic_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceTopic" ADD CONSTRAINT "SourceTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicEvidence" ADD CONSTRAINT "TopicEvidence_sourceTopicId_fkey" FOREIGN KEY ("sourceTopicId") REFERENCES "SourceTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicEvidenceSpan" ADD CONSTRAINT "TopicEvidenceSpan_topicEvidenceId_fkey" FOREIGN KEY ("topicEvidenceId") REFERENCES "TopicEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
