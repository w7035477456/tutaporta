import pool from '../../db/connection.js';
import { decryptDriveRefreshToken, encryptDriveRefreshToken } from '../recordVaultDrive/driveTokenCrypto.js';
import { getSingleLoginRedis } from '../singleLoginSession.js';
import { invalidateCachedOneDriveAuth } from './oneDriveAuthCache.js';
import { invalidateCachedOneDriveEmails } from './oneDriveEmailHistory.js';

/** Cluster-wide cache — shared Redis (same REDIS_URL as single-login sessions). */
export const ONEDRIVE_CONN_KEY_PREFIX = 'v1:onedrive:conn:';

/** Refreshed on read; invalidated on save / clear. */
const CACHE_TTL_SEC = 35 * 24 * 3600;
const CACHE_NONE_SENTINEL = '__none__';

export function oneDriveConnRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${ONEDRIVE_CONN_KEY_PREFIX}${id}`;
}

function parseCachedConnection(raw) {
  if (!raw || raw === CACHE_NONE_SENTINEL) return null;
  try {
    const parsed = JSON.parse(raw);
    const enc = String(parsed?.enc || '').trim();
    if (!enc) return null;
    return {
      enc,
      folderId: String(parsed?.folderId || '').trim() || null,
      email: String(parsed?.email || '').trim() || null
    };
  } catch {
    return null;
  }
}

function connectionFromEncRow(row) {
  if (!row?.enc) return null;
  let refreshToken = '';
  try {
    refreshToken = decryptDriveRefreshToken(row.enc);
  } catch (err) {
    console.error('[recordVaultOneDrive] decrypt token failed:', err?.message || err);
    return null;
  }
  if (!refreshToken) return null;
  return {
    refreshToken,
    folderId: String(row.folderId || '').trim() || null,
    email: String(row.email || '').trim() || null
  };
}

/**
 * @returns {Promise<'miss'|null|{ enc: string, folderId: string|null, email: string|null }>}
 *   'miss' = Redis unavailable or key absent; null = cached disconnected
 */
async function getCachedOneDriveConnectionRow(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return 'miss';
  try {
    const raw = await redis.get(oneDriveConnRedisKey(id));
    if (raw === null) return 'miss';
    if (raw === CACHE_NONE_SENTINEL) return null;
    const parsed = parseCachedConnection(raw);
    return parsed || 'miss';
  } catch {
    return 'miss';
  }
}

async function setCachedOneDriveConnectionRow(singlesId, row) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    if (!row?.enc) {
      await redis.set(oneDriveConnRedisKey(id), CACHE_NONE_SENTINEL, 'EX', CACHE_TTL_SEC);
      return;
    }
    await redis.set(
      oneDriveConnRedisKey(id),
      JSON.stringify({
        enc: row.enc,
        folderId: row.folderId || null,
        email: row.email || null
      }),
      'EX',
      CACHE_TTL_SEC
    );
  } catch {
    // Redis down — Postgres remains source of truth
  }
}

export async function invalidateCachedOneDriveConnection(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.del(oneDriveConnRedisKey(id));
  } catch {
    // ignore
  }
}

async function readOneDriveConnectionFromDb(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const { rows } = await pool.query(
    `SELECT record_notes_onedrive_refresh_token_enc,
            record_notes_onedrive_folder_id,
            record_notes_onedrive_email
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  const row = rows[0];
  const enc = String(row?.record_notes_onedrive_refresh_token_enc || '').trim();
  if (!enc) return null;
  return {
    enc,
    folderId: String(row.record_notes_onedrive_folder_id || '').trim() || null,
    email: String(row.record_notes_onedrive_email || '').trim() || null
  };
}

export async function loadOneDriveConnection(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;

  const cached = await getCachedOneDriveConnectionRow(id);
  if (cached !== 'miss') {
    return connectionFromEncRow(cached);
  }

  const row = await readOneDriveConnectionFromDb(id);
  await setCachedOneDriveConnectionRow(id, row);
  return connectionFromEncRow(row);
}

export async function saveOneDriveConnection(singlesId, { refreshToken, folderId = null, email = null }) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  const enc = encryptDriveRefreshToken(refreshToken);
  await pool.query(
    `UPDATE helloworldjunktest.singles
        SET record_notes_onedrive_refresh_token_enc = $2,
            record_notes_onedrive_folder_id = COALESCE($3, record_notes_onedrive_folder_id),
            record_notes_onedrive_email = COALESCE($4, record_notes_onedrive_email)
      WHERE singles_id = $1`,
    [id, enc, folderId, email]
  );
  // COALESCE may keep prior folder/email — invalidate so next read refreshes from Postgres.
  await invalidateCachedOneDriveConnection(id);
  await invalidateCachedOneDriveAuth(id);
  await invalidateCachedOneDriveEmails(id);
}

export async function clearOneDriveConnection(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  await pool.query(
    `UPDATE helloworldjunktest.singles
        SET record_notes_onedrive_refresh_token_enc = NULL,
            record_notes_onedrive_folder_id = NULL,
            record_notes_onedrive_email = NULL
      WHERE singles_id = $1`,
    [id]
  );
  await setCachedOneDriveConnectionRow(id, null);
  await invalidateCachedOneDriveAuth(id);
  await invalidateCachedOneDriveEmails(id);
}
