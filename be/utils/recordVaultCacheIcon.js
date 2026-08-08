import pool from '../db/connection.js';
import { getSingleLoginRedis } from './singleLoginSession.js';
import { normalizeRecordVaultIconName } from './recordVaultIconKeys.js';

/** @typedef {'onedrive' | 'usb'} RecordVaultCacheIconKind */

/** Cluster-wide cache — shared Redis (same REDIS_URL as single-login sessions). */
export const RECORD_VAULT_CACHE_ICON_KEY_PREFIX = 'v1:record_vault:cache_icon:';

/** Refreshed on read / vault unlock; invalidated on write / clear. */
const CACHE_TTL_SEC = 35 * 24 * 3600;
const CACHE_NONE_SENTINEL = '__none__';

const COLUMN_BY_KIND = {
  onedrive: 'cache_onedrive_icon',
  usb: 'cache_usb_icon'
};

function assertKind(kind) {
  const normalized = String(kind || '').trim().toLowerCase();
  if (normalized !== 'onedrive' && normalized !== 'usb') {
    throw new Error('cache icon kind must be onedrive or usb');
  }
  return /** @type {RecordVaultCacheIconKind} */ (normalized);
}

function columnForKind(kind) {
  return COLUMN_BY_KIND[assertKind(kind)];
}

export function recordVaultCacheIconRedisKey(singlesId, kind) {
  const id = Math.trunc(Number(singlesId));
  const k = assertKind(kind);
  return `${RECORD_VAULT_CACHE_ICON_KEY_PREFIX}${k}:${id}`;
}

async function readCacheIconFromDb(singlesId, kind) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const column = columnForKind(kind);
  const result = await pool.query(
    `SELECT ${column} AS cache_icon
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  const raw = result.rows?.[0]?.cache_icon;
  const icon = normalizeRecordVaultIconName(raw);
  return icon || null;
}

/**
 * @returns {Promise<string|null|undefined>} undefined = Redis miss/unavailable
 */
async function getCachedRecordVaultCacheIcon(singlesId, kind) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return undefined;
  try {
    const raw = await redis.get(recordVaultCacheIconRedisKey(id, kind));
    if (raw === null) return undefined;
    if (raw === CACHE_NONE_SENTINEL) return null;
    const icon = normalizeRecordVaultIconName(raw);
    return icon || null;
  } catch {
    return undefined;
  }
}

async function setCachedRecordVaultCacheIcon(singlesId, kind, iconName) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  const icon = normalizeRecordVaultIconName(iconName);
  const value = icon || CACHE_NONE_SENTINEL;
  try {
    await redis.set(recordVaultCacheIconRedisKey(id, kind), value, 'EX', CACHE_TTL_SEC);
  } catch {
    // Redis down — Postgres remains source of truth
  }
}

export async function invalidateCachedRecordVaultCacheIcon(singlesId, kind = null) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  const kinds = kind ? [assertKind(kind)] : ['onedrive', 'usb'];
  try {
    await redis.del(...kinds.map((k) => recordVaultCacheIconRedisKey(id, k)));
  } catch {
    // ignore
  }
}

export async function readRecordVaultCacheIcon(singlesId, kind) {
  const id = Number(singlesId);
  const k = assertKind(kind);
  if (!Number.isFinite(id) || id < 1) return null;

  const cached = await getCachedRecordVaultCacheIcon(id, k);
  if (cached !== undefined) return cached;

  const icon = await readCacheIconFromDb(id, k);
  await setCachedRecordVaultCacheIcon(id, k, icon);
  return icon;
}

export async function writeRecordVaultCacheIcon(singlesId, kind, iconName) {
  const id = Number(singlesId);
  const k = assertKind(kind);
  if (!Number.isFinite(id) || id < 1) return;
  const icon = normalizeRecordVaultIconName(iconName);
  if (!icon) return;
  const column = columnForKind(k);
  await pool.query(
    `UPDATE helloworldjunktest.singles
        SET ${column} = $1,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $2`,
    [icon, id]
  );
  await setCachedRecordVaultCacheIcon(id, k, icon);
}

export async function clearRecordVaultCacheIcon(singlesId, kind = null) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;

  if (kind) {
    const k = assertKind(kind);
    const column = columnForKind(k);
    await pool.query(
      `UPDATE helloworldjunktest.singles
          SET ${column} = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE singles_id = $1`,
      [id]
    );
    await setCachedRecordVaultCacheIcon(id, k, null);
    return;
  }

  await pool.query(
    `UPDATE helloworldjunktest.singles
        SET cache_onedrive_icon = NULL,
            cache_usb_icon = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $1`,
    [id]
  );
  await invalidateCachedRecordVaultCacheIcon(id);
  await setCachedRecordVaultCacheIcon(id, 'onedrive', null);
  await setCachedRecordVaultCacheIcon(id, 'usb', null);
}
