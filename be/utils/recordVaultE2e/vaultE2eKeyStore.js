/**
 * Yellow E2E: store only KDF params + wrapped DEK per storage backend.
 * Never sees Encrypt Password, KEK, or plaintext DEK.
 */
import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';

const ALLOWED_BACKENDS = new Set(['usb', 'onedrive', 'postgres']);

function schema() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

function b64ToBuf(b64) {
  if (b64 == null || b64 === '') return null;
  return Buffer.from(String(b64), 'base64');
}

function bufToB64(buf) {
  if (buf == null) return null;
  return Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(buf).toString('base64');
}

function mapVaultRow(row) {
  if (!row) return null;
  return {
    vaultId: Number(row.vault_id),
    singlesId: Number(row.singles_id),
    storageBackend: row.storage_backend,
    kdfAlgo: row.kdf_algo,
    kdfSaltB64: bufToB64(row.kdf_salt),
    kdfMemKib: Number(row.kdf_mem_kib),
    kdfTime: Number(row.kdf_time),
    kdfParallelism: Number(row.kdf_parallelism),
    wrappedDekB64: bufToB64(row.wrapped_dek),
    cryptoVersion: Number(row.crypto_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeBackends(raw) {
  const list = Array.isArray(raw) ? raw : ['usb', 'onedrive'];
  const out = [];
  for (const item of list) {
    const backend = String(item || '')
      .trim()
      .toLowerCase();
    if (ALLOWED_BACKENDS.has(backend) && !out.includes(backend)) out.push(backend);
  }
  return out.length ? out : ['usb', 'onedrive'];
}

function parseKeyPayload(payload) {
  const kdfSalt = b64ToBuf(payload?.kdfSaltB64);
  const wrappedDek = b64ToBuf(payload?.wrappedDekB64);
  if (!kdfSalt?.length || !wrappedDek?.length) {
    throw Object.assign(new Error('kdfSaltB64 and wrappedDekB64 are required'), { status: 400 });
  }
  return {
    kdfAlgo: payload?.kdfAlgo || 'argon2id',
    kdfSalt,
    kdfMemKib: Number(payload?.kdfMemKib) || 65536,
    kdfTime: Number(payload?.kdfTime) || 3,
    kdfParallelism: Number(payload?.kdfParallelism) || 1,
    wrappedDek,
    cryptoVersion: Number(payload?.cryptoVersion) || 1
  };
}

/** Any backend row for this user (same password material for usb + onedrive). */
export async function getAnyVaultKey(singlesId) {
  const s = schema();
  const { rows } = await pool.query(
    `SELECT *
       FROM ${s}.notes_vault
      WHERE singles_id = $1
      ORDER BY CASE storage_backend
        WHEN 'usb' THEN 0
        WHEN 'onedrive' THEN 1
        ELSE 2
      END
      LIMIT 1`,
    [Number(singlesId)]
  );
  return mapVaultRow(rows[0]);
}

export async function getVaultKey(singlesId, storageBackend) {
  const backend = String(storageBackend || '')
    .trim()
    .toLowerCase();
  if (!ALLOWED_BACKENDS.has(backend)) {
    throw Object.assign(new Error('Invalid storage_backend'), { status: 400 });
  }
  const s = schema();
  const { rows } = await pool.query(
    `SELECT *
       FROM ${s}.notes_vault
      WHERE singles_id = $1
        AND storage_backend = $2
      LIMIT 1`,
    [Number(singlesId), backend]
  );
  return mapVaultRow(rows[0]);
}

/** Upsert salt + wrapped DEK for each backend (identical material = one Encrypt Password). */
export async function upsertVaultKeys(singlesId, payload) {
  const key = parseKeyPayload(payload);
  const backends = normalizeBackends(payload?.backends);
  const s = schema();
  const mapped = [];

  for (const backend of backends) {
    const { rows } = await pool.query(
      `INSERT INTO ${s}.notes_vault (
         singles_id, storage_backend, kdf_algo, kdf_salt, kdf_mem_kib, kdf_time, kdf_parallelism,
         wrapped_dek, crypto_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (singles_id, storage_backend) DO UPDATE SET
         kdf_algo = EXCLUDED.kdf_algo,
         kdf_salt = EXCLUDED.kdf_salt,
         kdf_mem_kib = EXCLUDED.kdf_mem_kib,
         kdf_time = EXCLUDED.kdf_time,
         kdf_parallelism = EXCLUDED.kdf_parallelism,
         wrapped_dek = EXCLUDED.wrapped_dek,
         crypto_version = EXCLUDED.crypto_version,
         updated_at = now()
       RETURNING *`,
      [
        Number(singlesId),
        backend,
        key.kdfAlgo,
        key.kdfSalt,
        key.kdfMemKib,
        key.kdfTime,
        key.kdfParallelism,
        key.wrappedDek,
        key.cryptoVersion
      ]
    );
    mapped.push(mapVaultRow(rows[0]));
  }

  return { backends, vaults: mapped, vault: mapped[0] || null };
}

export async function updateVaultKeys(singlesId, payload) {
  return upsertVaultKeys(singlesId, payload);
}
