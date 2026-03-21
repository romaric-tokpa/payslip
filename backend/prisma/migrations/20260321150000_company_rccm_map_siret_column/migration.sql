-- Le champ Prisma `rccm` est mappé sur la colonne SQL `siret` (schéma d’origine).
-- Si une base avait déjà renommé `siret` → `rccm`, on revient à `siret` pour cohérence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Company' AND column_name = 'rccm'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Company' AND column_name = 'siret'
  ) THEN
    ALTER TABLE "Company" RENAME COLUMN "rccm" TO "siret";
  END IF;
END $$;
