import pool from '../db/connection.js';
import { isAdminImpersonationSession } from './adminAuth.js';
import {
  isAdminMemberCategory,
  isInitialSetupBypassMemberCategory,
  normalizeMemberCategoryEnum
} from './memberCategory.js';

export const ID_INITIALIZATION_REQUIRED_CODE = 'ID_INITIALIZATION_REQUIRED';
export const ID_INITIALIZATION_REQUIRED_MESSAGE =
  'Please finish the one-time Identification Verification setup before using this feature.';

export function normalizeIdInitializationCompleted(raw) {
  if (raw === true || raw === 1) return true;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === 't' || s === '1';
}

/** DemoUser / RegularMember / Admin rows never go through mandatory ID initialization. */
export function isIdInitializationExemptMemberCategory(memberCategory) {
  return isInitialSetupBypassMemberCategory(memberCategory) || isAdminMemberCategory(memberCategory);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 */
export async function markIdInitializationCompleted(db, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const { rowCount } = await db.query(
    `UPDATE outdateddbsnapshotoct2024.singles
     SET id_initialization_completed = true,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
       AND id_initialization_completed IS DISTINCT FROM true`,
    [id]
  );
  if (rowCount > 0) {
    console.log('[idInitialization] completed', { singlesId: id });
  }
  return true;
}

/**
 * Manual live-scan video fallback: complete only when the server already holds a driver
 * license ↔ profile Match (or DL/passport check is skipped site-wide), over_18_verified = true,
 * and a live face scan video consent record exists.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @param {{ skipDlPassportCheck?: boolean, liveFaceScanVideoDescription: string }} options
 */
export async function completeIdInitializationAfterManualVideoIfEligible(
  db,
  singlesId,
  { skipDlPassportCheck = false, liveFaceScanVideoDescription }
) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const { rows } = await db.query(
    `SELECT s.over_18_verified,
            s.dl_profile_scan_result,
            EXISTS (
              SELECT 1
              FROM outdateddbsnapshotoct2024.consent_record cr
              WHERE cr.member_id = s.singles_id
                AND cr.description = $2
                AND cr.consent_signature_video_fk IS NOT NULL
            ) AS has_live_scan_video
     FROM outdateddbsnapshotoct2024.singles s
     WHERE s.singles_id = $1
     LIMIT 1`,
    [id, liveFaceScanVideoDescription]
  );
  const row = rows[0];
  if (!row || row.over_18_verified !== true || !row.has_live_scan_video) return false;
  const dlMatched = String(row.dl_profile_scan_result ?? '').trim() === 'Match';
  if (!skipDlPassportCheck && !dlMatched) return false;
  return markIdInitializationCompleted(db, id);
}

/** Primary read — gate must not lag behind the completion write. */
export async function loadIdInitializationGateRow(singlesId) {
  const { rows } = await pool.query(
    `SELECT member_category::text AS member_category, id_initialization_completed
     FROM outdateddbsnapshotoct2024.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return rows[0] ?? null;
}

/**
 * Express middleware — 403 { code: ID_INITIALIZATION_REQUIRED } until
 * singles.id_initialization_completed = true. Admin tools / impersonation and exempt
 * member categories pass through.
 */
export async function requireIdInitializationCompleted(req, res, next) {
  const auth = req.auth;
  if (auth?.tools_only === true || isAdminImpersonationSession(auth)) return next();
  const singlesId = Number(auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const row = await loadIdInitializationGateRow(singlesId);
    if (!row) return res.status(401).json({ error: 'Authentication required' });
    if (isIdInitializationExemptMemberCategory(normalizeMemberCategoryEnum(row.member_category))) return next();
    if (normalizeIdInitializationCompleted(row.id_initialization_completed)) return next();
    return res.status(403).json({
      error: ID_INITIALIZATION_REQUIRED_MESSAGE,
      code: ID_INITIALIZATION_REQUIRED_CODE
    });
  } catch (err) {
    console.error('[idInitialization] gate check failed', err?.message || err);
    return res.status(500).json({ error: 'Failed to check Identification Verification status' });
  }
}
