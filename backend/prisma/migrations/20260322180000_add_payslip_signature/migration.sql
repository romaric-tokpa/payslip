-- AlterTable
ALTER TABLE "Company" ADD COLUMN "require_signature" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN "is_signed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payslip" ADD COLUMN "signed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "payslip_signatures" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "full_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "verification_code" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payslip_signatures_payslip_id_key" ON "payslip_signatures"("payslip_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslip_signatures_verification_code_key" ON "payslip_signatures"("verification_code");

-- CreateIndex
CREATE INDEX "payslip_signatures_company_id_idx" ON "payslip_signatures"("company_id");

-- CreateIndex
CREATE INDEX "payslip_signatures_user_id_idx" ON "payslip_signatures"("user_id");

-- CreateIndex
CREATE INDEX "payslip_signatures_verification_code_idx" ON "payslip_signatures"("verification_code");

-- CreateIndex
CREATE INDEX "payslip_signatures_company_id_period_year_period_month_idx" ON "payslip_signatures"("company_id", "period_year", "period_month");

-- AddForeignKey
ALTER TABLE "payslip_signatures" ADD CONSTRAINT "payslip_signatures_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_signatures" ADD CONSTRAINT "payslip_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_signatures" ADD CONSTRAINT "payslip_signatures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
