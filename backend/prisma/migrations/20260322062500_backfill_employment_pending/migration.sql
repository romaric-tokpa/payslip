-- Collaborateurs invités mais non activés : session INVITATION encore présente
UPDATE "User" u
SET employment_status = 'PENDING'
WHERE u.role = 'EMPLOYEE'
  AND u.is_active = false
  AND EXISTS (
    SELECT 1 FROM "Session" s
    WHERE s.user_id = u.id AND s.device_info = 'INVITATION'
  );
