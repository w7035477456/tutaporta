-- Client-side E2E Notes vault (opaque ciphertext metadata in Postgres).
-- Server stores wrapped DEK + ciphertext only — never derives KEK or decrypts content.
-- Safe for round-robin / non-sticky: no server-side vault key session.
-- Table renamed from record_vault → notes_vault (see renameRecordVaultToNotesVault.sql).
--
-- Mac: psql -h 127.0.0.1 -p 50010 -U test_user1 -d onlinemallwebsite -f be/db/addRecordVaultPostgresE2e.sql

BEGIN;

CREATE TABLE IF NOT EXISTS helloworldjunktest.notes_vault (
  vault_id         bigserial PRIMARY KEY,
  singles_id       bigint NOT NULL
                   REFERENCES helloworldjunktest.singles (singles_id) ON DELETE CASCADE,
  storage_backend  text NOT NULL DEFAULT 'postgres',
  -- Password -> KEK derivation params (client-side); safe in plaintext:
  kdf_algo         text NOT NULL DEFAULT 'argon2id',
  kdf_salt         bytea NOT NULL,
  kdf_mem_kib      int NOT NULL DEFAULT 65536,
  kdf_time         int NOT NULL DEFAULT 3,
  kdf_parallelism  int NOT NULL DEFAULT 1,
  wrapped_dek      bytea NOT NULL,                 -- DEK sealed by KEK (iv|tag|ct)
  crypto_version   smallint NOT NULL DEFAULT 1,
  quota_bytes_used bigint NOT NULL DEFAULT 0,
  access_failed_attempts integer NOT NULL DEFAULT 0,
  access_locked_until timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (singles_id, storage_backend),
  CONSTRAINT notes_vault_storage_backend_chk CHECK (storage_backend IN ('postgres', 'onedrive', 'usb')),
  CONSTRAINT notes_vault_kdf_algo_chk CHECK (kdf_algo IN ('argon2id')),
  CONSTRAINT notes_vault_access_failed_attempts_chk CHECK (access_failed_attempts >= 0)
);

COMMENT ON TABLE helloworldjunktest.notes_vault IS
  'TutaNotes E2E vault metadata: KDF params + wrapped DEK. Server cannot unwrap DEK.';
COMMENT ON COLUMN helloworldjunktest.notes_vault.wrapped_dek IS
  'AES-GCM sealed DEK (12-byte IV || 16-byte tag || ciphertext). Opaque to server.';
COMMENT ON COLUMN helloworldjunktest.notes_vault.kdf_salt IS
  'Argon2id salt for client KEK derivation. Not secret alone.';
COMMENT ON COLUMN helloworldjunktest.notes_vault.access_failed_attempts IS
  'Consecutive incorrect vault-password attempts for this storage backend.';
COMMENT ON COLUMN helloworldjunktest.notes_vault.access_locked_until IS
  'Timestamp before which another vault-password attempt is prohibited.';

CREATE TABLE IF NOT EXISTS helloworldjunktest.record_vault_item (
  item_id        bigserial PRIMARY KEY,
  vault_id       bigint NOT NULL
                 REFERENCES helloworldjunktest.notes_vault (vault_id) ON DELETE CASCADE,
  item_type      text NOT NULL,                 -- notebook|note|shortcut
  parent_id      bigint
                 REFERENCES helloworldjunktest.record_vault_item (item_id) ON DELETE CASCADE,
  display_order  int NOT NULL DEFAULT 0,
  content        bytea NOT NULL,                -- encrypted JSON (name, body_html, keywords, flags…)
  content_bytes  int NOT NULL DEFAULT 0,
  rev            bigint NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT record_vault_item_type_chk CHECK (item_type IN ('notebook', 'note', 'shortcut'))
);

CREATE INDEX IF NOT EXISTS record_vault_item_vault_type_deleted_idx
  ON helloworldjunktest.record_vault_item (vault_id, item_type, deleted_at);
CREATE INDEX IF NOT EXISTS record_vault_item_vault_parent_idx
  ON helloworldjunktest.record_vault_item (vault_id, parent_id);

COMMENT ON TABLE helloworldjunktest.record_vault_item IS
  'Notebooks/notes/shortcuts as opaque ciphertext rows. Server never decrypts content.';
COMMENT ON COLUMN helloworldjunktest.record_vault_item.content IS
  'AES-GCM sealed payload (iv|tag|ct). Opaque to server.';
COMMENT ON COLUMN helloworldjunktest.record_vault_item.rev IS
  'Optimistic concurrency: UPDATE … WHERE rev = base_rev; bump on success.';

CREATE TABLE IF NOT EXISTS helloworldjunktest.record_vault_file (
  file_id        bigserial PRIMARY KEY,
  vault_id       bigint NOT NULL
                 REFERENCES helloworldjunktest.notes_vault (vault_id) ON DELETE CASCADE,
  item_id        bigint NOT NULL
                 REFERENCES helloworldjunktest.record_vault_item (item_id) ON DELETE CASCADE,
  file_kind      text NOT NULL,                 -- attachment|image
  meta           bytea NOT NULL,                -- encrypted file_name, extension, mime
  content        bytea NOT NULL,                -- encrypted file bytes
  content_bytes  int NOT NULL DEFAULT 0,
  rev            bigint NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT record_vault_file_kind_chk CHECK (file_kind IN ('attachment', 'image'))
);

CREATE INDEX IF NOT EXISTS record_vault_file_vault_item_deleted_idx
  ON helloworldjunktest.record_vault_file (vault_id, item_id, deleted_at);

COMMENT ON TABLE helloworldjunktest.record_vault_file IS
  'Attachments/images as opaque ciphertext. meta + content encrypted client-side.';

COMMIT;
