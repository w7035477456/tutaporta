-- TutaPhotoAlbums E2E vault keys — independent from TutaNotes `notes_vault`.
-- Same shape as live notes_vault (KDF params + wrapped DEK per storage backend).
-- Encrypt Password for Photo must not share Notes wrapped_dek / kdf_salt.
--
-- Mac:
--   psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addPhotoAlbumsVaultE2e.sql
--
-- Run renameRecordVaultToNotesVault.sql first if you still have legacy record_vault.

BEGIN;

CREATE TABLE IF NOT EXISTS helloworldjunktest.photo_albums_vault (
  vault_id         bigserial PRIMARY KEY,
  singles_id       bigint NOT NULL
                   REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  storage_backend  text NOT NULL,
  kdf_algo         text NOT NULL DEFAULT 'argon2id',
  kdf_salt         bytea NOT NULL,
  kdf_mem_kib      int NOT NULL DEFAULT 65536,
  kdf_time         int NOT NULL DEFAULT 3,
  kdf_parallelism  int NOT NULL DEFAULT 1,
  wrapped_dek      bytea NOT NULL,
  crypto_version   smallint NOT NULL DEFAULT 1,
  access_failed_attempts integer NOT NULL DEFAULT 0,
  access_locked_until timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (singles_id, storage_backend),
  CONSTRAINT photo_albums_vault_storage_backend_chk CHECK (storage_backend IN ('onedrive', 'usb')),
  CONSTRAINT photo_albums_vault_kdf_algo_chk CHECK (kdf_algo IN ('argon2id')),
  CONSTRAINT photo_albums_vault_access_failed_attempts_chk CHECK (access_failed_attempts >= 0)
);

COMMENT ON TABLE helloworldjunktest.photo_albums_vault IS
  'TutaPhotoAlbums E2E vault metadata (KDF + wrapped DEK). Independent from helloworldjunktest.notes_vault (TutaNotes).';
COMMENT ON COLUMN helloworldjunktest.photo_albums_vault.wrapped_dek IS
  'AES-GCM sealed DEK for Photo Albums only. Opaque to server.';
COMMENT ON COLUMN helloworldjunktest.photo_albums_vault.kdf_salt IS
  'Argon2id salt for Photo Albums client KEK derivation.';
COMMENT ON COLUMN helloworldjunktest.photo_albums_vault.access_failed_attempts IS
  'Consecutive incorrect Photo Albums vault-password attempts for this storage backend.';
COMMENT ON COLUMN helloworldjunktest.photo_albums_vault.access_locked_until IS
  'Legacy lock column (Photo Albums no longer enforces cooldown); kept for schema parity.';

-- One-time seed: copy existing Notes keys so current Photo vaults still open.
-- After this, Notes password changes only touch notes_vault; Photo only photo_albums_vault.
INSERT INTO helloworldjunktest.photo_albums_vault (
  singles_id, storage_backend, kdf_algo, kdf_salt, kdf_mem_kib, kdf_time, kdf_parallelism,
  wrapped_dek, crypto_version, access_failed_attempts, access_locked_until,
  created_at, updated_at
)
SELECT
  singles_id, storage_backend, kdf_algo, kdf_salt, kdf_mem_kib, kdf_time, kdf_parallelism,
  wrapped_dek, crypto_version, 0, NULL,
  created_at, updated_at
FROM helloworldjunktest.notes_vault nv
WHERE nv.storage_backend IN ('onedrive', 'usb')
  AND NOT EXISTS (
  SELECT 1
    FROM helloworldjunktest.photo_albums_vault pav
   WHERE pav.singles_id = nv.singles_id
     AND pav.storage_backend = nv.storage_backend
);

COMMIT;
