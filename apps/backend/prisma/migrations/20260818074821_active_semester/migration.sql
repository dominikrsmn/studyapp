/*
  Warnings:

  - A unique constraint covering the columns `[activeSemesterId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeSemesterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_activeSemesterId_key" ON "User"("activeSemesterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeSemesterId_fkey" FOREIGN KEY ("activeSemesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
