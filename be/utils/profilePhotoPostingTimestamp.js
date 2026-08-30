import { coerceDate } from './regularMemberActivityTimestamp.js';

/** Canonical caption for auto / seeded profile-photo change postings. */
export const PROFILE_PHOTO_CHANGE_POST_CONTENT = 'User changed Profile Photo';

/** Random profile-photo post date falls within this many months before the member's oldest other post. */
export const PROFILE_PHOTO_POST_LOOKBACK_MONTHS = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30.4375 * MS_PER_DAY;
const EXCLUDE_RECENT_MS = 24 * 60 * 60 * 1000;

function maxAllowedStampMs() {
  return Date.now() - EXCLUDE_RECENT_MS;
}

/**
 * @param {unknown} content
 * @returns {boolean}
 */
export function isProfilePhotoChangePostContent(content) {
  return String(content ?? '').trim() === PROFILE_PHOTO_CHANGE_POST_CONTENT;
}

/**
 * Random timestamp in `[anchorAt - months, anchorAt)` (strictly before anchor).
 * @param {Date | string | number} anchorAt
 * @param {number} [months]
 * @returns {Date}
 */
export function randomTimestampBeforeAnchorWithinMonths(
  anchorAt,
  months = PROFILE_PHOTO_POST_LOOKBACK_MONTHS
) {
  const anchorMs = coerceDate(anchorAt)?.getTime();
  if (!Number.isFinite(anchorMs)) {
    return randomTimestampWithinLastMonths(months);
  }

  const safeMonths = Number.isFinite(Number(months)) && Number(months) > 0 ? Number(months) : PROFILE_PHOTO_POST_LOOKBACK_MONTHS;
  const windowMs = safeMonths * MS_PER_MONTH;
  const earliestMs = anchorMs - windowMs;
  const latestMs = anchorMs - 1000;
  if (latestMs <= earliestMs) {
    return new Date(Math.max(0, earliestMs));
  }
  const offsetMs = Math.floor(Math.random() * (latestMs - earliestMs + 1));
  return new Date(earliestMs + offsetMs);
}

/**
 * Random timestamp within the last `months` months, excluding the last 24 hours.
 * @param {number} [months]
 * @returns {Date}
 */
export function randomTimestampWithinLastMonths(months = PROFILE_PHOTO_POST_LOOKBACK_MONTHS) {
  const safeMonths = Number.isFinite(Number(months)) && Number(months) > 0 ? Number(months) : PROFILE_PHOTO_POST_LOOKBACK_MONTHS;
  const maxMs = maxAllowedStampMs();
  const spanMs = safeMonths * MS_PER_MONTH;
  const earliestMs = Math.max(0, maxMs - spanMs);
  const offsetMs = Math.floor(Math.random() * (maxMs - earliestMs + 1));
  return new Date(earliestMs + offsetMs);
}

/**
 * Oldest top-level posting for a member, excluding profile-photo posts and optionally one post id.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} postingsSchema
 * @param {number} singlesId
 * @param {{ excludePostId?: number | null }} [options]
 * @returns {Promise<Date | null>}
 */
export async function loadOldestOtherPostingCreatedAt(db, postingsSchema, singlesId, options = {}) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const schema = String(postingsSchema || 'helloworldjunktest').replace(/"/g, '""');
  const excludePostId = Number(options?.excludePostId);
  const params = [id, PROFILE_PHOTO_CHANGE_POST_CONTENT];
  let excludeSql = '';
  if (Number.isFinite(excludePostId) && excludePostId > 0) {
    params.push(excludePostId);
    excludeSql = ` AND p.post_id <> $${params.length}`;
  }
  const result = await db.query(
    `SELECT MIN(p.created_at) AS oldest_at
     FROM "${schema}".postings p
     WHERE p.singles_id = $1
       AND p.parent_post_id IS NULL
       AND BTRIM(COALESCE(p.content, '')) <> $2${excludeSql}`,
    params
  );
  return coerceDate(result.rows[0]?.oldest_at);
}

/**
 * Profile-photo change posts are always stamped before every other posting:
 * random within 6 months before the member's oldest other post (or last 6 months when alone).
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} postingsSchema
 * @param {number} singlesId
 * @param {{ excludePostId?: number | null }} [options]
 * @returns {Promise<Date>}
 */
export async function resolveProfilePhotoChangePostingTimestamp(db, postingsSchema, singlesId, options = {}) {
  const oldestOther = await loadOldestOtherPostingCreatedAt(db, postingsSchema, singlesId, options);
  if (oldestOther) {
    return randomTimestampBeforeAnchorWithinMonths(oldestOther, PROFILE_PHOTO_POST_LOOKBACK_MONTHS);
  }
  return randomTimestampWithinLastMonths(PROFILE_PHOTO_POST_LOOKBACK_MONTHS);
}

/**
 * @param {Date | string | number | null | undefined} profilePhotoCreatedAt
 * @param {Date | string | number | null | undefined} oldestOtherCreatedAt
 * @returns {boolean}
 */
export function profilePhotoPostingNeedsEarlierTimestamp(profilePhotoCreatedAt, oldestOtherCreatedAt) {
  const profileMs = coerceDate(profilePhotoCreatedAt)?.getTime();
  const oldestMs = coerceDate(oldestOtherCreatedAt)?.getTime();
  if (!Number.isFinite(oldestMs)) return false;
  if (!Number.isFinite(profileMs)) return true;
  return profileMs >= oldestMs;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} postingsSchema
 * @param {number} postId
 * @param {Date} createdAt
 * @param {{ disableFkTriggers?: boolean }} [options]
 */
export async function restampPostingCreatedAt(client, postingsSchema, postId, createdAt, options = {}) {
  const schema = String(postingsSchema || 'helloworldjunktest').replace(/"/g, '""');
  const id = Number(postId);
  const stamp = coerceDate(createdAt);
  if (!Number.isFinite(id) || id < 1 || !stamp) {
    throw new Error('restampPostingCreatedAt: invalid post id or created_at');
  }
  const iso = stamp.toISOString();
  if (options.disableFkTriggers !== false) {
    await client.query('SET LOCAL session_replication_role = replica');
  }
  await client.query(
    `UPDATE "${schema}".postings
     SET created_at = $2::timestamptz
     WHERE post_id = $1`,
    [id, iso]
  );
  await client.query(
    `UPDATE "${schema}".posting_photos
     SET post_created_at = $2::timestamptz
     WHERE post_id = $1`,
    [id, iso]
  );
  await client.query(
    `UPDATE "${schema}".posting_comments pc
     SET photo_post_created_at = $2::timestamptz
     FROM "${schema}".posting_photos pp
     WHERE pc.photo_id = pp.photo_id
       AND pp.post_id = $1`,
    [id, iso]
  );
}
