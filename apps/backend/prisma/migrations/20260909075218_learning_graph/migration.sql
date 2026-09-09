/*
  Warnings:

  - You are about to drop the column `contentRevision` on the `Module` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Module" DROP COLUMN "contentRevision",
ADD COLUMN     "graphVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "embedding" vector;

-- AlterTable
ALTER TABLE "TopicEvidence" ADD COLUMN     "embedding" vector;

-- CreateTable
CREATE TABLE "LearningGraph" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProcessingState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "LearningGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TopicDependencies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TopicDependencies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TopicDependencies_B_index" ON "_TopicDependencies"("B");

-- AddForeignKey
ALTER TABLE "LearningGraph" ADD CONSTRAINT "LearningGraph_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicDependencies" ADD CONSTRAINT "_TopicDependencies_A_fkey" FOREIGN KEY ("A") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicDependencies" ADD CONSTRAINT "_TopicDependencies_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
