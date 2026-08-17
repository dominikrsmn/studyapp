/*
  Warnings:

  - You are about to drop the column `pageNumber` on the `SourceChunk` table. All the data in the column will be lost.
  - Added the required column `chunkIndex` to the `SourceChunk` table without a default value. This is not possible if the table is not empty.

*/

CREATE EXTENSION IF NOT EXISTS vector;


-- AlterTable
ALTER TABLE "SourceChunk" DROP COLUMN "pageNumber",
ADD COLUMN     "chunkIndex" INTEGER NOT NULL,
ADD COLUMN     "pageEnd" INTEGER,
ADD COLUMN     "pageStart" INTEGER,
ADD COLUMN     "embedding" VECTOR(1536);
