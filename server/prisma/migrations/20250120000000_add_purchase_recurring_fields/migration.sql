-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "recurringEndDate" TIMESTAMP(3),
ADD COLUMN "recurringGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Purchase_recurringGroupId_idx" ON "Purchase"("recurringGroupId");

