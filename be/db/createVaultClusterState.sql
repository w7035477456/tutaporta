-- TutaPhoto / TutaNotes vault coherence across PM2 workers and web servers
-- (be/utils/vaultClusterCoherence.js). The backend also creates this lazily on first use.
CREATE TABLE IF NOT EXISTS helloworldjunktest.vault_cluster_state (
  product text NOT NULL,
  singles_id bigint NOT NULL,
  storage_type text NOT NULL,
  unlocked boolean NOT NULL DEFAULT false,
  unlock_generation bigint NOT NULL DEFAULT 0,
  mount_path text,
  backup_mount_path text,
  drive_folder_id text,
  unlocked_at timestamptz,
  unlock_expires_at timestamptz,
  db_version bigint NOT NULL DEFAULT 0,
  lock_token text,
  lock_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT vault_cluster_state_pkey PRIMARY KEY (product, singles_id, storage_type),
  CONSTRAINT vault_cluster_state_product_check CHECK (product IN ('photo_albums', 'record_vault')),
  CONSTRAINT vault_cluster_state_storage_type_check CHECK (storage_type IN ('usb', 'onedrive'))
);
