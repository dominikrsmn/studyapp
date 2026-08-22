/*
  Warnings:

  - You are about to drop the column `parentId` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the `_ExerciseToTopic` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `topicEvidenceId` to the `Topic` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TopicState" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT "Topic_parentId_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToTopic" DROP CONSTRAINT "_ExerciseToTopic_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToTopic" DROP CONSTRAINT "_ExerciseToTopic_B_fkey";

-- DropIndex
DROP INDEX "Topic_parentId_idx";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "parentId",
ADD COLUMN     "state" "TopicState" NOT NULL DEFAULT 'SUGGESTED',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "topicEvidenceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ExerciseToTopic";

-- CreateTable
CREATE TABLE "TopicEvidence" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "TopicEvidence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_topicEvidenceId_fkey" FOREIGN KEY ("topicEvidenceId") REFERENCES "TopicEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
