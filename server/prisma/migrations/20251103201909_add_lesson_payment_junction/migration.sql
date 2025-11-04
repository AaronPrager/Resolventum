-- CreateTable
CREATE TABLE "LessonPayment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonPayment_lessonId_idx" ON "LessonPayment"("lessonId");

-- CreateIndex
CREATE INDEX "LessonPayment_paymentId_idx" ON "LessonPayment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonPayment_lessonId_paymentId_key" ON "LessonPayment"("lessonId", "paymentId");

-- AddForeignKey
ALTER TABLE "LessonPayment" ADD CONSTRAINT "LessonPayment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPayment" ADD CONSTRAINT "LessonPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: Create LessonPayment records for lessons that have a paymentId
INSERT INTO "LessonPayment" ("id", "lessonId", "paymentId", "amount", "createdAt")
SELECT 
    gen_random_uuid()::text as id,
    l.id as lessonId,
    l."paymentId" as paymentId,
    COALESCE(l."paidAmount", l.price, 0) as amount,
    NOW() as createdAt
FROM "Lesson" l
WHERE l."paymentId" IS NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Lesson_paymentId_idx";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "paymentId";

