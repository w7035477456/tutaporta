-- Rename TutaNotes E2E key table: record_vault → notes_vault
-- (photo_albums_vault stays separate for TutaPhotoAlbums)
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d outdatedDBOct2021 \
--     -f be/db/renameRecordVaultToNotesVault.sql
--
-- Safe to re-run: no-op when notes_vault already exists / record_vault is gone.

BEGIN;

DO $$
BEGIN
  IF to_regclass('outdateddbsnapshotoct2024.record_vault') IS NOT NULL
     AND to_regclass('outdateddbsnapshotoct2024.notes_vault') IS NULL THEN
    ALTER TABLE outdateddbsnapshotoct2024.record_vault RENAME TO notes_vault;
  END IF;
END
$$;

-- Sequence owned by vault_id (bigserial)
DO $$
BEGIN
  IF to_regclass('outdateddbsnapshotoct2024.record_vault_vault_id_seq') IS NOT NULL
     AND to_regclass('outdateddbsnapshotoct2024.notes_vault_vault_id_seq') IS NULL THEN
    ALTER SEQUENCE outdateddbsnapshotoct2024.record_vault_vault_id_seq
      RENAME TO notes_vault_vault_id_seq;
  END IF;
END
$$;

-- Constraints (names only; table already notes_vault after rename above)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'record_vault_storage_backend_chk'
       AND conrelid = 'outdateddbsnapshotoct2024.notes_vault'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.notes_vault
      RENAME CONSTRAINT record_vault_storage_backend_chk TO notes_vault_storage_backend_chk;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'record_vault_kdf_algo_chk'
       AND conrelid = 'outdateddbsnapshotoct2024.notes_vault'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.notes_vault
      RENAME CONSTRAINT record_vault_kdf_algo_chk TO notes_vault_kdf_algo_chk;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'record_vault_access_failed_attempts_chk'
       AND conrelid = 'outdateddbsnapshotoct2024.notes_vault'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.notes_vault
      RENAME CONSTRAINT record_vault_access_failed_attempts_chk
        TO notes_vault_access_failed_attempts_chk;
  END IF;

  -- Unique (singles_id, storage_backend) often auto-named record_vault_singles_id_storage_backend_key
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'record_vault_singles_id_storage_backend_key'
       AND conrelid = 'outdateddbsnapshotoct2024.notes_vault'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.notes_vault
      RENAME CONSTRAINT record_vault_singles_id_storage_backend_key
        TO notes_vault_singles_id_storage_backend_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'record_vault_pkey'
       AND conrelid = 'outdateddbsnapshotoct2024.notes_vault'::regclass
  ) THEN
    ALTER TABLE outdateddbsnapshotoct2024.notes_vault
      RENAME CONSTRAINT record_vault_pkey TO notes_vault_pkey;
  END IF;
END
$$;

COMMENT ON TABLE outdateddbsnapshotoct2024.notes_vault IS
  'TutaNotes E2E vault metadata: KDF params + wrapped DEK. Server cannot unwrap DEK. (renamed from record_vault)';
COMMENT ON COLUMN outdateddbsnapshotoct2024.notes_vault.wrapped_dek IS
  'AES-GCM sealed DEK (12-byte IV || 16-byte tag || ciphertext). Opaque to server.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.notes_vault.kdf_salt IS
  'Argon2id salt for client KEK derivation. Not secret alone.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.notes_vault.access_failed_attempts IS
  'Consecutive incorrect vault-password attempts for this storage backend.';
COMMENT ON COLUMN outdateddbsnapshotoct2024.notes_vault.access_locked_until IS
  'Timestamp before which another vault-password attempt is prohibited.';

COMMIT;
