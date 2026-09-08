-- AlterTable
ALTER TABLE "AiRequestCost" ADD COLUMN     "jobId" TEXT;

-- CreateTable
CREATE TABLE "SourceJob" (
    "id" TEXT NOT NULL,
    "sourceIds" TEXT[],
    "name" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SourceJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceJob_sourceIds_idx" ON "SourceJob" USING GIN ("sourceIds");

-- CreateIndex
CREATE INDEX "AiRequestCost_jobId_idx" ON "AiRequestCost"("jobId");

-- AddForeignKey
ALTER TABLE "AiRequestCost" ADD CONSTRAINT "AiRequestCost_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SourceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
