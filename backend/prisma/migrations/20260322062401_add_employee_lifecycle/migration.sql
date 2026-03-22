-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PENDING', 'ACTIVE', 'ON_NOTICE', 'DEPARTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'INTERIM', 'STAGE');

-- CreateEnum
CREATE TYPE "DepartureType" AS ENUM ('RESIGNATION', 'TERMINATION', 'CONTRACT_END', 'RETIREMENT', 'MUTUAL_AGREEMENT');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "read_only_days_after_departure" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "contract_end_date" TIMESTAMP(3),
ADD COLUMN     "contract_type" "ContractType",
ADD COLUMN     "departed_at" TIMESTAMP(3),
ADD COLUMN     "departed_by_id" TEXT,
ADD COLUMN     "departure_date" TIMESTAMP(3),
ADD COLUMN     "departure_reason" TEXT,
ADD COLUMN     "departure_type" "DepartureType",
ADD COLUMN     "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "notice_end_date" TIMESTAMP(3),
ADD COLUMN     "notice_start_date" TIMESTAMP(3),
ADD COLUMN     "read_only_until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_employment_status_idx" ON "User"("employment_status");

-- CreateIndex
CREATE INDEX "User_departed_by_id_idx" ON "User"("departed_by_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departed_by_id_fkey" FOREIGN KEY ("departed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
