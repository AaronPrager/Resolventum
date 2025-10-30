-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "alert" TEXT,
ADD COLUMN     "allDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showAs" TEXT NOT NULL DEFAULT 'busy',
ADD COLUMN     "travelTime" INTEGER;
