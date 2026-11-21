-- Canonical cloud storage id is tutaCloud (replaces onedrive + tutadrive enums).
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 -f be/db/renameStorageTypeOnedriveTutadriveToTutaCloud.sql
-- Ubuntu Primary:
--   scripts/ubuntu-psql.sh -f be/db/renameStorageTypeOnedriveTutadriveToTutaCloud.sql

BEGIN;

-- notes_vault
ALTER TABLE outdateddbsnapshotoct2024.notes_vault
  DROP CONSTRAINT IF EXISTS notes_vault_storage_backend_chk;
UPDATE outdateddbsnapshotoct2024.notes_vault
   SET storage_backend = 'tutaCloud', updated_at = NOW()
 WHERE storage_backend IN ('onedrive', 'tutadrive');
ALTER TABLE outdateddbsnapshotoct2024.notes_vault
  ADD CONSTRAINT notes_vault_storage_backend_chk
  CHECK (storage_backend IN ('postgres', 'tutaCloud', 'usb'));

-- photo_albums_vault
ALTER TABLE outdateddbsnapshotoct2024.photo_albums_vault
  DROP CONSTRAINT IF EXISTS photo_albums_vault_storage_backend_chk;
UPDATE outdateddbsnapshotoct2024.photo_albums_vault
   SET storage_backend = 'tutaCloud', updated_at = NOW()
 WHERE storage_backend IN ('onedrive', 'tutadrive');
ALTER TABLE outdateddbsnapshotoct2024.photo_albums_vault
  ADD CONSTRAINT photo_albums_vault_storage_backend_chk
  CHECK (storage_backend IN ('tutaCloud', 'usb'));

-- vault_cluster_state
ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  DROP CONSTRAINT IF EXISTS vault_cluster_state_storage_type_check;
-- Prefer existing tutaCloud row if both old+new exist for same PK legs
DELETE FROM outdateddbsnapshotoct2024.vault_cluster_state old
 WHERE old.storage_type IN ('onedrive', 'tutadrive')
   AND EXISTS (
     SELECT 1 FROM outdateddbsnapshotoct2024.vault_cluster_state neu
      WHERE neu.product = old.product
        AND neu.singles_id = old.singles_id
        AND neu.storage_type = 'tutaCloud'
   );
UPDATE outdateddbsnapshotoct2024.vault_cluster_state
   SET storage_type = 'tutaCloud', updated_at = NOW()
 WHERE storage_type IN ('onedrive', 'tutadrive');
ALTER TABLE outdateddbsnapshotoct2024.vault_cluster_state
  ADD CONSTRAINT vault_cluster_state_storage_type_check
  CHECK (storage_type IN ('usb', 'tutaCloud'));

-- Bill schedule / paid / email scan
DO $$
DECLARE
  t text;
  cname text;
BEGIN
  FOREACH t IN ARRAY ARRAY['monthly_bill', 'yearly_bill', 'paid_record', 'email_scan', 'email_scan_inbox']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'outdateddbsnapshotoct2024'
         AND table_name = t
         AND column_name = 'storage_backend'
    ) THEN
      EXECUTE format(
        'ALTER TABLE outdateddbsnapshotoct2024.%I DROP CONSTRAINT IF EXISTS %I',
        t, t || '_storage_backend_chk'
      );
      EXECUTE format(
        'ALTER TABLE outdateddbsnapshotoct2024.%I DROP CONSTRAINT IF EXISTS %I',
        t, t || '_storage_backend_check'
      );
      -- also drop unnamed / alternate constraint names
      FOR cname IN
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'outdateddbsnapshotoct2024'
           AND rel.relname = t
           AND con.contype = 'c'
           AND pg_get_constraintdef(con.oid) ILIKE '%storage_backend%'
      LOOP
        EXECUTE format('ALTER TABLE outdateddbsnapshotoct2024.%I DROP CONSTRAINT IF EXISTS %I', t, cname);
      END LOOP;
      EXECUTE format(
        'UPDATE outdateddbsnapshotoct2024.%I SET storage_backend = %L WHERE storage_backend IN (%L, %L)',
        t, 'tutaCloud', 'onedrive', 'tutadrive'
      );
      EXECUTE format(
        'ALTER TABLE outdateddbsnapshotoct2024.%I ADD CONSTRAINT %I CHECK (storage_backend IN (%L, %L))',
        t, t || '_storage_backend_chk', 'tutaCloud', 'usb'
      );
      EXECUTE format(
        'ALTER TABLE outdateddbsnapshotoct2024.%I ALTER COLUMN storage_backend SET DEFAULT %L',
        t, 'tutaCloud'
      );
    END IF;
  END LOOP;
END $$;

-- Photo albums invites / shared albums storage_type
DO $$
DECLARE
  t text;
  cname text;
BEGIN
  FOREACH t IN ARRAY ARRAY['photo_albums_invites', 'photo_albums_shared_albums']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'outdateddbsnapshotoct2024'
         AND table_name = t
         AND column_name = 'storage_type'
    ) THEN
      FOR cname IN
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         WHERE nsp.nspname = 'outdateddbsnapshotoct2024'
           AND rel.relname = t
           AND con.contype = 'c'
           AND pg_get_constraintdef(con.oid) ILIKE '%storage_type%'
      LOOP
        EXECUTE format('ALTER TABLE outdateddbsnapshotoct2024.%I DROP CONSTRAINT IF EXISTS %I', t, cname);
      END LOOP;
      EXECUTE format(
        'UPDATE outdateddbsnapshotoct2024.%I SET storage_type = %L WHERE storage_type IN (%L, %L)',
        t, 'tutaCloud', 'onedrive', 'tutadrive'
      );
      EXECUTE format(
        'ALTER TABLE outdateddbsnapshotoct2024.%I ADD CONSTRAINT %I CHECK (storage_type IN (%L, %L))',
        t, t || '_storage_type_chk', 'tutaCloud', 'usb'
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
