import { getSingleLoginRedis } from '../singleLoginSession.js';

/** Short-lived Microsoft Graph access token + vault folder — avoids repeated Postgres reads. */
export const ONEDRIVE_AUTH_KEY_PREFIX = 'v1:onedrive:auth:';

const DEFAULT_ACCESS_TTL_SEC = 50 * 60;
const MIN_ACCESS_TTL_SEC = 60;

export function oneDriveAuthRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${ONEDRIVE_AUTH_KEY_PREFIX}${id}`;
}

function parseCachedAuth(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const accessToken = String(parsed?.accessToken || '').trim();
    const folderId = String(parsed?.folderId || '').trim();
    if (!accessToken || !folderId) return null;
    return {
      accessToken,
      folderId,
      email: String(parsed?.email || '').trim() || null
    };
  } catch {
    return null;
  }
}

/** @returns {Promise<{ accessToken: string, folderId: string, email: string|null }|null>} */
export async function getCachedOneDriveAuth(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return null;
  try {
    const raw = await redis.get(oneDriveAuthRedisKey(id));
    return parseCachedAuth(raw);
  } catch {
    return null;
  }
}

export async function setCachedOneDriveAuth(singlesId, { accessToken, folderId, email = null, expiresInSec } = {}) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  const token = String(accessToken || '').trim();
  const folder = String(folderId || '').trim();
  if (!redis || !Number.isFinite(id) || id < 1 || !token || !folder) return;

  const expiresRaw = Math.trunc(Number(expiresInSec));
  const ttl =
    Number.isFinite(expiresRaw) && expiresRaw > MIN_ACCESS_TTL_SEC
      ? Math.min(DEFAULT_ACCESS_TTL_SEC, Math.max(MIN_ACCESS_TTL_SEC, expiresRaw - 60))
      : DEFAULT_ACCESS_TTL_SEC;

  try {
    await redis.set(
      oneDriveAuthRedisKey(id),
      JSON.stringify({ accessToken: token, folderId: folder, email: email || null }),
      'EX',
      ttl
    );
  } catch {
    // Redis down — fall back to Postgres on each call
  }
}

export async function invalidateCachedOneDriveAuth(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.del(oneDriveAuthRedisKey(id));
  } catch {
    // ignore
  }
}
