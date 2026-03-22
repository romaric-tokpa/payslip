-- Renseigne company_id sur les journaux existants à partir de l’utilisateur auteur.
UPDATE "AuditLog" AS a
SET "company_id" = u.company_id
FROM "User" AS u
WHERE a.user_id = u.id
  AND a.company_id IS NULL
  AND u.company_id IS NOT NULL;
