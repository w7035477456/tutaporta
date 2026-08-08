-- Backfill singles.status = active for accounts that already completed registration
-- (email, phone, password, profile photo) but still have default blank.
-- Primary only.
-- Mac dev:
-- psql -h 127.0.0.1 -p 50010 -U test_user1 -d vsingles -f be/db/backfillSinglesActiveStatus.sql

UPDATE helloworldjunktest.singles
SET status = 'active'::helloworldjunktest.singles_status,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'blank'::helloworldjunktest.singles_status
  AND profile_image_fk IS NOT NULL
  AND email IS NOT NULL
  AND BTRIM(email::text) <> ''
  AND phone IS NOT NULL
  AND BTRIM(phone) <> ''
  AND password_hash IS NOT NULL
  AND BTRIM(password_hash) <> '';
