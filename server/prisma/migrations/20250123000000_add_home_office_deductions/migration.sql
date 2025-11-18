-- CreateTable
CREATE TABLE "HomeOfficeDeduction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "periodType" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "deductionPercent" DOUBLE PRECISION NOT NULL,
    "deductibleAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeOfficeDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeOfficeDeduction_userId_idx" ON "HomeOfficeDeduction"("userId");

-- CreateIndex
CREATE INDEX "HomeOfficeDeduction_category_idx" ON "HomeOfficeDeduction"("category");

-- CreateIndex
CREATE INDEX "HomeOfficeDeduction_period_idx" ON "HomeOfficeDeduction"("period");

-- CreateIndex
CREATE INDEX "HomeOfficeDeduction_periodType_idx" ON "HomeOfficeDeduction"("periodType");

-- AddForeignKey
ALTER TABLE "HomeOfficeDeduction" ADD CONSTRAINT "HomeOfficeDeduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

