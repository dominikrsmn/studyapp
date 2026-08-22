/*
  Warnings:

  - You are about to drop the column `topicEvidenceId` on the `Topic` table. All the data in the column will be lost.
  - Added the required column `description` to the `Topic` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `TopicEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT "Topic_topicEvidenceId_fkey";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "topicEvidenceId",
ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TopicEvidence" ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "TopicEvidence_topicId_idx" ON "TopicEvidence"("topicId");

-- AddForeignKey
ALTER TABLE "TopicEvidence" ADD CONSTRAINT "TopicEvidence_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
