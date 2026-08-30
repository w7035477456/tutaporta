import { isRegularMemberCategory } from './memberCategory.js';
import { APPROVAL_STATUS_NO_RESPONSE } from './approvalStatusEnum.js';
import { loadMemberCategoryForSinglesId } from './regularMemberActivityTimestamp.js';

/**
 * REGULARMEMBER accounts never submit bio-request responses — approvals stay `noresponse`.
 * @param {unknown} memberCategory
 * @returns {boolean}
 */
export function isRegularMemberBioRequestApprovalLocked(memberCategory) {
  return isRegularMemberCategory(memberCategory);
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @returns {Promise<boolean>}
 */
export async function isRegularMemberBioRequestApprovalLockedForSinglesId(db, singlesId) {
  const category = await loadMemberCategoryForSinglesId(db, singlesId);
  return isRegularMemberBioRequestApprovalLocked(category);
}

/**
 * @param {Record<string, unknown>} row
 * @param {unknown} memberCategory
 * @returns {Record<string, unknown>}
 */
export function sanitizeIncomingBioRequestApprovalRow(row, memberCategory) {
  if (!isRegularMemberBioRequestApprovalLocked(memberCategory)) return row;
  return {
    ...row,
    brief_bio_request_approval: APPROVAL_STATUS_NO_RESPONSE,
    full_bio_request_approval: APPROVAL_STATUS_NO_RESPONSE,
    brief_approval_date: null,
    full_approval_date: null
  };
}

/**
 * Persist `noresponse` for every incoming request row owned by a REGULARMEMBER.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} schemaName
 * @param {number} singlesIdTo
 * @param {unknown} memberCategory
 * @returns {Promise<number>}
 */
export async function enforceRegularMemberBioRequestApprovalsInDb(db, schemaName, singlesIdTo, memberCategory) {
  if (!isRegularMemberBioRequestApprovalLocked(memberCategory)) return 0;
  const id = Number(singlesIdTo);
  if (!Number.isFinite(id) || id < 1) return 0;

  const schema = String(schemaName || 'helloworldjunktest').replace(/"/g, '""');
  const quotedSchema = `"${schema}"`;
  const cols = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN (
         'brief_bio_request_approval',
         'full_bio_request_approval',
         'brief_approval_date',
         'full_approval_date'
       )`,
    [schema]
  );
  const has = new Set(cols.rows.map((row) => row.column_name));
  if (!has.has('brief_bio_request_approval') && !has.has('full_bio_request_approval')) return 0;

  const setParts = [];
  if (has.has('brief_bio_request_approval')) {
    setParts.push(`brief_bio_request_approval = 'noresponse'::${quotedSchema}.approval_status_enum`);
  }
  if (has.has('full_bio_request_approval')) {
    setParts.push(`full_bio_request_approval = 'noresponse'::${quotedSchema}.approval_status_enum`);
  }
  if (has.has('brief_approval_date')) {
    setParts.push('brief_approval_date = NULL');
  }
  if (has.has('full_approval_date')) {
    setParts.push('full_approval_date = NULL');
  }
  setParts.push('updated_at = CURRENT_TIMESTAMP');

  const whereParts = [];
  if (has.has('brief_bio_request_approval')) {
    whereParts.push(
      `LOWER(BTRIM(COALESCE(brief_bio_request_approval::text, 'noresponse'))) NOT IN ('noresponse', 'na', '', 'null')`
    );
  }
  if (has.has('full_bio_request_approval')) {
    whereParts.push(
      `LOWER(BTRIM(COALESCE(full_bio_request_approval::text, 'noresponse'))) NOT IN ('noresponse', 'na', '', 'null')`
    );
  }
  if (has.has('brief_approval_date')) {
    whereParts.push('brief_approval_date IS NOT NULL');
  }
  if (has.has('full_approval_date')) {
    whereParts.push('full_approval_date IS NOT NULL');
  }
  if (!whereParts.length) return 0;

  const result = await db.query(
    `UPDATE ${quotedSchema}.requests
     SET ${setParts.join(', ')}
     WHERE singles_id_to = $1
       AND (${whereParts.join(' OR ')})`,
    [id]
  );
  return result.rowCount ?? 0;
}

/**
 * @param {unknown} memberCategory
 * @param {unknown} nextApproval
 * @returns {boolean} true when the write must be rejected
 */
export function regularMemberBioRequestApprovalWriteBlocked(memberCategory, nextApproval) {
  if (!isRegularMemberBioRequestApprovalLocked(memberCategory)) return false;
  const normalized = String(nextApproval ?? '').trim().toLowerCase();
  return normalized !== APPROVAL_STATUS_NO_RESPONSE && normalized !== 'na' && normalized !== '';
}
