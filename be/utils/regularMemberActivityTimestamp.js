/**
 * RegularMember demo/test accounts: stamp activity rows with a random time
 * instead of CURRENT_TIMESTAMP.
 *
 * - First activity: random date/time within the last 3 years (never today).
 * - Later activity: random time a few weeks after the previous stamp
 *   (never in the future, never the current date, always after the previous post).
 * - Non–RegularMember: callers get null and keep normal “now” defaults.
 */

const REGULAR_MEMBER_CATEGORY = 'regularmember';
export const DEFAULT_LOOKBACK_YEARS = 3;
/** Do not stamp RegularMember activity on the current calendar day. */
const EXCLUDE_RECENT_MS = 24 * 60 * 60 * 1000;
/** Prefer a few weeks after the previous RegularMember stamp. */
const AFTER_PREVIOUS_MIN_DAYS = 14;
const AFTER_PREVIOUS_MAX_DAYS = 28;

function maxAllowedStampMs() {
  return Date.now() - EXCLUDE_RECENT_MS;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isRegularMemberCategory(raw) {
  return String(raw ?? '').trim().toLowerCase() === REGULAR_MEMBER_CATEGORY;
}

/**
 * Random Date within the last `years` years, excluding the last 24 hours
 * so RegularMember posts never show today's date/time.
 * @param {number} [years]
 * @returns {Date}
 */
export function randomTimestampWithinLastYears(years = DEFAULT_LOOKBACK_YEARS) {
  const lookback = Number(years);
  const safeYears = Number.isFinite(lookback) && lookback > 0 ? lookback : DEFAULT_LOOKBACK_YEARS;
  const maxMs = maxAllowedStampMs();
  const spanMs = Math.max(1, Math.floor(safeYears * 365.25 * 24 * 60 * 60 * 1000) - EXCLUDE_RECENT_MS);
  const offsetMs = Math.floor(Math.random() * (spanMs + 1));
  return new Date(maxMs - offsetMs);
}

/**
 * Random timestamp after `previousAt`, typically +2..4 weeks with a random clock time.
 * Always strictly after `previousAt`. Prefer not today / not the future; if there is
 * no room before that cap, still stay after the previous stamp.
 * @param {Date | string | number} previousAt
 * @returns {Date}
 */
export function randomTimestampAfterPrevious(previousAt) {
  const prevMs = new Date(previousAt).getTime();
  const maxMs = maxAllowedStampMs();
  if (!Number.isFinite(prevMs)) {
    return randomTimestampWithinLastYears(DEFAULT_LOOKBACK_YEARS);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const minDays = AFTER_PREVIOUS_MIN_DAYS;
  const maxDays = AFTER_PREVIOUS_MAX_DAYS;
  const daySpan = Math.max(0, maxDays - minDays);
  const daysAhead = minDays + Math.floor(Math.random() * (daySpan + 1));
  const randomTimeOfDayMs = Math.floor(Math.random() * dayMs);
  let nextMs = prevMs + daysAhead * dayMs + randomTimeOfDayMs;

  if (nextMs > maxMs) {
    const room = maxMs - prevMs;
    if (room <= 1000) {
      return new Date(prevMs + 1000);
    }
    const minGap = Math.min(60 * 60 * 1000, Math.floor(room / 4));
    nextMs = prevMs + minGap + Math.floor(Math.random() * Math.max(1, room - minGap));
    if (nextMs > maxMs) nextMs = maxMs;
    if (nextMs <= prevMs) nextMs = prevMs + 1000;
  }

  return new Date(nextMs);
}

/**
 * Sequential RegularMember posting stamps: first in the last 3 years, each later
 * post a few weeks after the previous. Used by Save and by the backfill script.
 * @param {number} count
 * @returns {Date[]}
 */
export function planRegularMemberPostingTimestamps(count) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (n < 1) return [];

  const dayMs = 24 * 60 * 60 * 1000;
  const maxMs = maxAllowedStampMs();
  const lookbackMs = Math.floor(DEFAULT_LOOKBACK_YEARS * 365.25 * dayMs);
  const minGapMs = AFTER_PREVIOUS_MIN_DAYS * dayMs;
  const reservedMs = (n - 1) * minGapMs;
  const firstLo = maxMs - lookbackMs;
  const firstHi = Math.max(firstLo, maxMs - reservedMs);
  const firstMs = firstLo + Math.floor(Math.random() * (firstHi - firstLo + 1));

  const stamps = [new Date(firstMs)];
  for (let i = 1; i < n; i += 1) {
    stamps.push(randomTimestampAfterPrevious(stamps[i - 1]));
  }
  return stamps;
}

/**
 * @param {unknown} raw
 * @returns {Date | null}
 */
export function coerceDate(raw) {
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  const ms = d.getTime();
  return Number.isFinite(ms) ? d : null;
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @returns {Promise<string | null>} member_category text or null
 */
export async function loadMemberCategoryForSinglesId(db, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const result = await db.query(
    `SELECT member_category::text AS member_category
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0]?.member_category != null ? String(result.rows[0].member_category) : null;
}

/**
 * For RegularMember:
 * - if `previousAt` is set → random few weeks after that (never today, always later)
 * - else → random within last 3 years (never today)
 * For everyone else: null (caller keeps DB default / now).
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @param {{ previousAt?: Date | string | number | null }} [options]
 * @returns {Promise<Date | null>}
 */
export async function resolveRegularMemberActivityTimestamp(db, singlesId, options = {}) {
  const category = await loadMemberCategoryForSinglesId(db, singlesId);
  if (!isRegularMemberCategory(category)) return null;

  const previousAt = coerceDate(options?.previousAt);
  if (previousAt) {
    return randomTimestampAfterPrevious(previousAt);
  }
  return randomTimestampWithinLastYears(DEFAULT_LOOKBACK_YEARS);
}

/**
 * Latest posting.created_at for this member.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} postingsSchema
 * @param {number} singlesId
 * @returns {Promise<Date | null>}
 */
export async function loadLatestPostingCreatedAt(db, postingsSchema, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const schema = String(postingsSchema || 'helloworldjunktest').replace(/"/g, '""');
  const result = await db.query(
    `SELECT MAX(p.created_at) AS previous_at
     FROM "${schema}".postings p
     WHERE p.singles_id = $1`,
    [id]
  );
  return coerceDate(result.rows[0]?.previous_at);
}

/**
 * Latest posting_comments.created_at for this author.
 * Prefer same photo thread when photoId is provided.
 * If no prior comment on that photo, fall back to the photo's post_created_at
 * so the first comment still lands after the posting.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} postingsSchema
 * @param {number} authorSinglesId
 * @param {{ photoId?: number | null }} [options]
 * @returns {Promise<Date | null>}
 */
export async function loadLatestCommentCreatedAt(db, postingsSchema, authorSinglesId, options = {}) {
  const id = Number(authorSinglesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const schema = String(postingsSchema || 'helloworldjunktest').replace(/"/g, '""');
  const photoId = Number(options?.photoId);
  if (Number.isFinite(photoId) && photoId > 0) {
    const onPhoto = await db.query(
      `SELECT MAX(pc.created_at) AS previous_at
       FROM "${schema}".posting_comments pc
       WHERE pc.author_id = $1
         AND pc.photo_id = $2`,
      [id, photoId]
    );
    const fromPhoto = coerceDate(onPhoto.rows[0]?.previous_at);
    if (fromPhoto) return fromPhoto;

    const postStamp = await db.query(
      `SELECT pp.post_created_at AS previous_at
       FROM "${schema}".posting_photos pp
       WHERE pp.photo_id = $1
       LIMIT 1`,
      [photoId]
    );
    const fromPost = coerceDate(postStamp.rows[0]?.previous_at);
    if (fromPost) return fromPost;
  }
  const result = await db.query(
    `SELECT MAX(pc.created_at) AS previous_at
     FROM "${schema}".posting_comments pc
     WHERE pc.author_id = $1`,
    [id]
  );
  return coerceDate(result.rows[0]?.previous_at);
}

/**
 * Latest photos.created_at for this member.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @returns {Promise<Date | null>}
 */
export async function loadLatestPhotoCreatedAt(db, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const result = await db.query(
    `SELECT MAX(p.created_at) AS previous_at
     FROM helloworldjunktest.photos p
     WHERE p.singles_id = $1`,
    [id]
  );
  return coerceDate(result.rows[0]?.previous_at);
}

/**
 * Latest videos.created_at for this member.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @returns {Promise<Date | null>}
 */
export async function loadLatestVideoCreatedAt(db, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return null;
  const result = await db.query(
    `SELECT MAX(v.created_at) AS previous_at
     FROM helloworldjunktest.videos v
     WHERE v.singles_id = $1`,
    [id]
  );
  return coerceDate(result.rows[0]?.previous_at);
}
