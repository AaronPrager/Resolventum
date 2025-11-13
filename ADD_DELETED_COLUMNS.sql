-- Run this SQL directly on your database to add the deleted columns
-- This migration adds soft delete functionality to the User table

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

