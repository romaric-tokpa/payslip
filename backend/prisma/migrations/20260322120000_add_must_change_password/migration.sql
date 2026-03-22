-- AlterTable
ALTER TABLE "User" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "temp_password_expires_at" TIMESTAMP(3);
