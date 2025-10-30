-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "locationType" TEXT NOT NULL DEFAULT 'in-person',
ADD COLUMN     "recurringEndDate" TIMESTAMP(3),
ADD COLUMN     "recurringFrequency" TEXT,
ADD COLUMN     "recurringGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Lesson_recurringGroupId_idx" ON "Lesson"("recurringGroupId");
