-- AlterTable
ALTER TABLE "User" ADD COLUMN "fileStorageType" TEXT DEFAULT 'local',
ADD COLUMN "googleDriveAccessToken" TEXT,
ADD COLUMN "googleDriveRefreshToken" TEXT,
ADD COLUMN "googleDriveTokenExpiry" TIMESTAMP(3),
ADD COLUMN "googleDriveFolderId" TEXT;



