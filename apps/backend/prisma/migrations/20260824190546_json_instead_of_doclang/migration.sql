/*
  Warnings:

  - You are about to drop the column `doclang` on the `Source` table. All the data in the column will be lost.
  - You are about to drop the column `doclingVersion` on the `Source` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Source" DROP COLUMN "doclang",
DROP COLUMN "doclingVersion",
ADD COLUMN     "document" JSONB;
