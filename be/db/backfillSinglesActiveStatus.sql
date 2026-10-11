-- Backfill singles.status = active for accounts that already completed registration
-- (email, phone, password, profile photo) but still have default blank.
-- Primary only.
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/backfillSinglesActiveStatus.sql

UPDATE outdateddbsnapshotoct2024.singles
SET status = 'active'::outdateddbsnapshotoct2024.singles_status,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'blank'::outdateddbsnapshotoct2024.singles_status
  AND profile_image_fk IS NOT NULL
  AND email IS NOT NULL
  AND BTRIM(email::text) <> ''
  AND phone IS NOT NULL
  AND BTRIM(phone) <> ''
  AND password_hash IS NOT NULL
  AND BTRIM(password_hash) <> '';
