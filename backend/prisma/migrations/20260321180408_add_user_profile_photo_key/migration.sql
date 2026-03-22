-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profile_photo_key" TEXT;

-- RenameIndex
ALTER INDEX "direction_company_name" RENAME TO "Direction_company_id_name_key";
