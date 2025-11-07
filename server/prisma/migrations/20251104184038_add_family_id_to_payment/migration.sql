-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "familyId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_familyId_idx" ON "Payment"("familyId");



