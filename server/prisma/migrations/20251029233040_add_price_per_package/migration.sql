-- AlterTable
ALTER TABLE "Student" ADD COLUMN "pricePerPackage" DOUBLE PRECISION,
DROP COLUMN IF EXISTS "pricingType";

