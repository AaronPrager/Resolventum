-- AlterTable
ALTER TABLE "Package" ADD COLUMN "paymentId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "packageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Package_paymentId_key" ON "Package"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_packageId_key" ON "Payment"("packageId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

