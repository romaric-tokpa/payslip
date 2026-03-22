-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "company_id" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_company_id_idx" ON "AuditLog"("company_id");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
