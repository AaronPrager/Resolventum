-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "packageId" TEXT;

-- CreateIndex
CREATE INDEX "Lesson_packageId_idx" ON "Lesson"("packageId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

