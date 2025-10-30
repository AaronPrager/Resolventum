/*
  Warnings:

  - You are about to drop the column `emergencyContactName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContactPhone` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `emergencyContactRelation` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `parentFirstName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `parentLastName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerLesson` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerPackage` on the `Student` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Student" DROP COLUMN "emergencyContactName",
DROP COLUMN "emergencyContactPhone",
DROP COLUMN "emergencyContactRelation",
DROP COLUMN "parentFirstName",
DROP COLUMN "parentLastName",
DROP COLUMN "pricePerLesson",
DROP COLUMN "pricePerPackage",
ADD COLUMN     "difficulties" TEXT,
ADD COLUMN     "emergencyContactInfo" TEXT,
ADD COLUMN     "parentAddress" TEXT,
ADD COLUMN     "parentFullName" TEXT;
