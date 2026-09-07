/*
  Warnings:

  - You are about to drop the `Exercise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExerciseAttempt` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "ExerciseAttempt" DROP CONSTRAINT "ExerciseAttempt_exerciseId_fkey";

-- DropTable
DROP TABLE "Exercise";

-- DropTable
DROP TABLE "ExerciseAttempt";

-- DropEnum
DROP TYPE "ExerciseAttemptResult";

-- DropEnum
DROP TYPE "ExerciseOrigin";

-- DropEnum
DROP TYPE "ExerciseType";
