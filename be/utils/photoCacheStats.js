/**
 * Per-IP photo GET cache stats (304 vs 200) for HUD + PM2 logs.
 * Keys share the rate-limit window TTL so counts reset with the RL window.
 */

import appLog from '../logger.js';

let redisClient = null;
let keyPrefix = 'pcs:';
let windowMs = 15 * 60 * 1000;

export function initPhotoCacheStats({ client, prefix, windowMs: w }) {
  redisClient = client || null;
  if (prefix) keyPrefix = prefix;
  if (Number.isFinite(w) && w > 0) windowMs = w;
}

function statsKey(clientIp) {
  return `${keyPrefix}${clientIp}`;
}

function windowMinutesLabel() {
  return Math.max(1, Math.round(windowMs / 60000));
}

/**
 * @param {string} clientIp
 * @param {boolean} is304
 * @param {number | string | null} [photoId]
 */
export async function recordPhotoCacheResult(clientIp, is304, photoId = null) {
  const status = is304 ? 304 : 200;
  const label = is304 ? 'HIT' : 'MISS';
  const idPart = photoId != null && photoId !== '' ? ` id=${photoId}` : '';
  let hits = 0;
  let misses = 0;
  let redisNote = '';

  if (redisClient && clientIp) {
    const field = is304 ? 'hits' : 'misses';
    const key = statsKey(clientIp);
    try {
      await redisClient
        .multi()
        .hincrby(key, field, 1)
        .pexpire(key, windowMs + 5000)
        .exec();
      const raw = await redisClient.hmget(key, 'hits', 'misses');
      hits = Number(raw?.[0]) || 0;
      misses = Number(raw?.[1]) || 0;
    } catch (err) {
      redisNote = ' redis=error';
      appLog.warn('[PhotoCache] record failed:', err?.message || err);
    }
  } else {
    redisNote = redisClient ? '' : ' redis=off';
  }

  const total = hits + misses;
  const pctCached = total > 0 ? Math.round((hits / total) * 100) : 0;
  const totalsPart =
    total > 0
      ? ` totals: hits=${hits} misses=${misses} (${pctCached}% cached)`
      : ' totals: (none — Redis not configured)';

  // Always console.log (same as [getMyPhotos]) — not gated by PM2_LOG_LEVEL.
  const line = `[PhotoCache] ${status} ${label}${idPart} ip=${clientIp} window=${windowMinutesLabel()}m${totalsPart}${redisNote}`;
  console.log(line);
  appLog.info(line);
}

/** @param {string} clientIp */
export async function readPhotoCacheStats(clientIp) {
  if (!redisClient || !clientIp) return null;
  try {
    const raw = await redisClient.hmget(statsKey(clientIp), 'hits', 'misses');
    const hits = Number(raw?.[0]) || 0;
    const misses = Number(raw?.[1]) || 0;
    return { hits, misses, total: hits + misses };
  } catch (err) {
    appLog.warn('[photoCacheStats] read failed:', err?.message || err);
    return null;
  }
}
