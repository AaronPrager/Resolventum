-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "paymentId" TEXT;

-- CreateIndex
CREATE INDEX "Lesson_paymentId_idx" ON "Lesson"("paymentId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

