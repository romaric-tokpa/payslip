-- Directions (optionnelles) : un département peut être rattaché à une direction ou non.
CREATE TABLE "Direction" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Direction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "direction_company_name" UNIQUE ("company_id", "name")
);

ALTER TABLE "Department" ADD COLUMN "direction_id" TEXT;

ALTER TABLE "Direction" ADD CONSTRAINT "Direction_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Department" ADD CONSTRAINT "Department_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "Direction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Direction_company_id_idx" ON "Direction"("company_id");
CREATE INDEX "Department_direction_id_idx" ON "Department"("direction_id");
