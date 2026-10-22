import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { allowAdminActionOnAccount, isProtectedAccountEmail } from '../../utils/protectedAccounts.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { normalizeUsPhoneDigits } from '../../utils/usPhoneValidation.js';
import { normalizeReferByCodeDigits } from '../../utils/referByCode.js';
import { recordAuditRegistrationSinglesStatusChange } from '../../utils/insertAuditRegistration.js';
import { PASSWORD_ATTEMPT_EPOCH } from '../../utils/passwordAttemptTracking.js';
import {
  MEMBER_CATEGORY_VALUES,
  nextMemberCategory,
  normalizeMemberCategoryEnum
} from '../../utils/memberCategory.js';
import { nextSinglesStatus, normalizeSinglesStatus, SINGLES_STATUS_VALUES } from '../../utils/singlesStatus.js';
import {
  appendAliasCondition,
  appendEmailCondition,
  appendMemberIdCondition,
  appendPhoneCondition,
  appendSinglesIdCondition,
  hasAdminLookupInput,
  lookupUsesWildcard,
  parseAliasLookup,
  parseEmailLookup,
  parseMemberIdLookup,
  parsePhoneLookup,
  parseSinglesIdLookup
} from '../../utils/adminLookupWildcard.js';
import { loadVideosBySinglesIds, mapSinglesLookupVideos } from '../../utils/loadVideosBySinglesIds.js';
import { RECORD4SUPPORT_FILE_PREFIX } from '../../utils/saveRecord4SupportVideo.js';
import { ensureDemoRegularInitialSetupDone } from '../../utils/ensureDemoRegularInitialSetupDone.js';
import { clearTutaNotesLock } from '../../utils/tutaNotesLock.js';
import { clearTutaPhotosLock } from '../../utils/tutaPhotosLock.js';
import { clearVaultAccessFailStatus } from '../../utils/recordVaultAccessFailGuard.js';
import { clearVaultAccessFailStatus as clearPhotoAlbumsAccessFailStatus } from '../../utils/photoAlbumsAccessFailGuard.js';
import { invalidateAuthUserCache } from '../../utils/authUserLookupCache.js';

const SINGLES_LOOKUP_WILDCARD_LIMIT = 500;

const SINGLES_LOOKUP_FROM_JOIN = `FROM outdateddbsnapshotoct2024.singles s
     LEFT JOIN outdateddbsnapshotoct2024.singles ref
       ON btrim(COALESCE(ref.my_refer_code::text, '')) = btrim(COALESCE(s.refer_by_code::text, ''))
      AND btrim(COALESCE(s.refer_by_code::text, '')) <> ''
     LEFT JOIN LATERAL (
       SELECT p.account_balance_token
       FROM outdateddbsnapshotoct2024.payment p
       WHERE p.singles_id = s.singles_id
       ORDER BY p.payment_id DESC
       LIMIT 1
     ) bal ON true`;

const SINGLES_LOOKUP_SELECT = `SELECT s.singles_id,
            s.member_id,
            s.member_category,
            s.status,
            s.email,
            s.phone,
            s.alias,
            s.password_attempt_count,
            s.lock_tuta_notes,
            s.lock_tuta_photos,
            s.my_refer_code,
            s.refer_by_code,
            s.profile_image_fk,
            s.over_18_verified,
            s.created_at,
            ref.singles_id AS refer_by_singles_id,
            COALESCE(bal.account_balance_token, 0) AS account_balance_token
     ${SINGLES_LOOKUP_FROM_JOIN}`;

/** Default Admin Tools singles order: newest account first. */
const SINGLES_LOOKUP_ORDER_BY = `ORDER BY s.created_at DESC NULLS LAST, s.singles_id DESC`;

function parseSinglesIdInput(raw) {
  const parsed = parseSinglesIdLookup(raw);
  return parsed?.mode === 'exact' ? parsed.value : null;
}

function parseMemberCategoryLookup(body) {
  return normalizeMemberCategoryEnum(body?.memberCategory ?? body?.member_category);
}

function hasLookupInput(body) {
  return hasAdminLookupInput(body) || Boolean(parseMemberCategoryLookup(body));
}

/**
 * Expand lookup criteria via singles matches, then UNION matching audit_registrations rows.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function searchAuditRegistrations(db, body) {
  const singlesMatches = await searchSinglesForLookup(db, body);

  const singlesIds = new Set();
  const emails = new Set();
  const phones = new Set();

  for (const row of singlesMatches) {
    if (row.singles_id != null) singlesIds.add(Number(row.singles_id));
    if (row.email) emails.add(normalizeEmailForDb(row.email));
    if (row.phone) phones.add(String(row.phone).trim());
  }

  const emailLookup = parseEmailLookup(body?.email);
  const phoneLookup = parsePhoneLookup(body?.phone);

  const singlesIdList = [...singlesIds].filter((id) => Number.isFinite(id) && id >= 1);
  const emailList = [...emails].filter(Boolean);
  const phoneList = [...phones].filter(Boolean);

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (singlesIdList.length) {
    conditions.push(`ar.singles_id = ANY($${paramIndex}::bigint[])`);
    params.push(singlesIdList);
    paramIndex += 1;
  }
  if (emailList.length) {
    conditions.push(`ar.email = ANY($${paramIndex}::text[])`);
    params.push(emailList);
    paramIndex += 1;
  }
  if (phoneList.length) {
    conditions.push(`ar.phone = ANY($${paramIndex}::text[])`);
    params.push(phoneList);
    paramIndex += 1;
  }

  if (emailLookup?.mode === 'like') {
    paramIndex = appendEmailCondition(conditions, params, emailLookup, paramIndex, 'ar.email');
  }
  if (phoneLookup?.mode === 'like') {
    paramIndex = appendPhoneCondition(conditions, params, phoneLookup, paramIndex, 'ar.phone');
  }

  if (!conditions.length) {
    return { rows: [], criteria: { singlesIds: [], emails: [], phones: [] } };
  }

  const { rows } = await db.query(
    `SELECT ar.audit_registration_id,
            ar.singles_id,
            ar.status,
            ar.date_update,
            ar.email,
            ar.phone
     FROM outdateddbsnapshotoct2024.audit_registrations ar
     WHERE ${conditions.join(' OR ')}
     ORDER BY ar.date_update DESC, ar.audit_registration_id DESC
     LIMIT ${lookupUsesWildcard(body) ? SINGLES_LOOKUP_WILDCARD_LIMIT : 1000}`,
    params
  );

  return {
    rows,
    criteria: {
      singlesIds: singlesIdList,
      emails: emailList,
      phones: phoneList
    }
  };
}

function mapSinglesLookupRow(row, videosBySinglesId = new Map()) {
  const rawTokenBalance = Number(row.account_balance_token);
  const profileImageFk = Number(row.profile_image_fk);
  const over18Raw = row.over_18_verified;
  const over18Verified =
    over18Raw === true || over18Raw === false
      ? over18Raw
      : over18Raw == null
        ? null
        : String(over18Raw).trim().toLowerCase() === 'true'
          ? true
          : String(over18Raw).trim().toLowerCase() === 'false'
            ? false
            : null;
  return {
    singlesId: Number(row.singles_id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    memberCategory: String(row.member_category ?? ''),
    status: String(row.status ?? 'blank'),
    over18Verified,
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    alias: String(row.alias ?? ''),
    createdAt: row.created_at ?? null,
    profileImageFk: Number.isFinite(profileImageFk) && profileImageFk > 0 ? profileImageFk : null,
    accountBalanceToken: Number.isFinite(rawTokenBalance) ? Math.trunc(rawTokenBalance) : 0,
    passwordAttemptCount:
      row.password_attempt_count != null && Number.isFinite(Number(row.password_attempt_count))
        ? Number(row.password_attempt_count)
        : 0,
    lockTutaNotes: Boolean(row.lock_tuta_notes),
    lockTutaPhotos: Boolean(row.lock_tuta_photos),
    myReferCode: String(row.my_refer_code ?? '').trim(),
    protectedAccount: isProtectedAccountEmail(row.email),
    referByCode: String(row.refer_by_code ?? '').trim(),
    referBySinglesId:
      row.refer_by_singles_id != null && Number.isFinite(Number(row.refer_by_singles_id))
        ? Number(row.refer_by_singles_id)
        : null,
    videos: mapSinglesLookupVideos(row, videosBySinglesId)
  };
}

/**
 * Direct singles-table matches for lookup inputs (OR across provided fields).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 */
export async function searchSinglesForLookup(db, body) {
  const singlesIdLookup = parseSinglesIdLookup(body?.singlesId ?? body?.singles_id);
  const emailLookup = parseEmailLookup(body?.email);
  const aliasLookup = parseAliasLookup(body?.alias);
  const memberIdLookup = parseMemberIdLookup(body?.memberId ?? body?.member_id);
  const phoneLookup = parsePhoneLookup(body?.phone);

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  paramIndex = appendSinglesIdCondition(conditions, params, singlesIdLookup, paramIndex);
  paramIndex = appendEmailCondition(conditions, params, emailLookup, paramIndex);
  paramIndex = appendAliasCondition(conditions, params, aliasLookup, paramIndex);
  paramIndex = appendMemberIdCondition(conditions, params, memberIdLookup, paramIndex);
  paramIndex = appendPhoneCondition(conditions, params, phoneLookup, paramIndex);
  const memberCategory = parseMemberCategoryLookup(body);
  if (memberCategory) {
    conditions.push(`s.member_category = \$${paramIndex}::outdateddbsnapshotoct2024.member_category_enum`);
    params.push(memberCategory);
    paramIndex += 1;
  }

  if (!conditions.length) {
    return [];
  }

  const limitClause = lookupUsesWildcard(body) ? ` LIMIT ${SINGLES_LOOKUP_WILDCARD_LIMIT}` : '';

  const { rows } = await db.query(
    `${SINGLES_LOOKUP_SELECT}
     WHERE ${conditions.join(' OR ')}
     ${SINGLES_LOOKUP_ORDER_BY}${limitClause}`,
    params
  );

  return rows;
}

/** All singles rows for Admin Tools → Lookup All (newest created_at first). */
export async function searchAllSinglesForLookup(db) {
  const { rows } = await db.query(`${SINGLES_LOOKUP_SELECT}
     ${SINGLES_LOOKUP_ORDER_BY}`);
  return rows;
}

/**
 * POST /api/admin/singles/lookup-all
 * Returns all outdateddbsnapshotoct2024.singles rows sorted by created_at descending.
 */
export async function postAdminSinglesLookupAll(req, res) {
  try {
    const singlesRows = await searchAllSinglesForLookup(pool);
    const singlesIds = singlesRows.map((row) => Number(row.singles_id)).filter((id) => Number.isFinite(id));
    const videosBySinglesId = await loadVideosBySinglesIds(pool, singlesIds, {
      fileNamePrefix: RECORD4SUPPORT_FILE_PREFIX
    });
    return res.json({
      singlesRows: singlesRows.map((row) => mapSinglesLookupRow(row, videosBySinglesId)),
      singlesCount: singlesRows.length,
      statusValues: [...SINGLES_STATUS_VALUES],
      memberCategoryValues: [...MEMBER_CATEGORY_VALUES]
    });
  } catch (err) {
    console.error('[postAdminSinglesLookupAll]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to lookup all singles rows.' });
  }
}

function mapAuditLookupRow(row) {
  return {
    auditRegistrationId: Number(row.audit_registration_id),
    singlesId: row.singles_id != null ? Number(row.singles_id) : null,
    status: String(row.status ?? ''),
    dateUpdate: row.date_update,
    email: String(row.email ?? ''),
    phone: String(row.phone ?? '')
  };
}

/**
 * POST /api/admin/audit-registrations/lookup
 * Body: { singlesId?, email?, alias?, memberId?, phone?, memberCategory? }
 */
export async function postAdminAuditRegistrationLookup(req, res) {
  try {
    if (!hasLookupInput(req.body)) {
      return res.status(400).json({ error: 'Enter Single Id, Email, Alias, Member Id, Phone, or Category.' });
    }

    const { rows, criteria } = await searchAuditRegistrations(pool, req.body);
    const singlesRows = await searchSinglesForLookup(pool, req.body);
    const singlesIds = singlesRows.map((row) => Number(row.singles_id)).filter((id) => Number.isFinite(id));
    const videosBySinglesId = await loadVideosBySinglesIds(pool, singlesIds, {
      fileNamePrefix: RECORD4SUPPORT_FILE_PREFIX
    });

    return res.json({
      singlesRows: singlesRows.map((row) => mapSinglesLookupRow(row, videosBySinglesId)),
      rows: rows.map(mapAuditLookupRow),
      criteria,
      count: rows.length,
      singlesCount: singlesRows.length,
      statusValues: [...SINGLES_STATUS_VALUES],
      memberCategoryValues: [...MEMBER_CATEGORY_VALUES]
    });
  } catch (err) {
    console.error('[postAdminAuditRegistrationLookup]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to lookup audit registrations.' });
  }
}

/**
 * POST /api/admin/singles/cycle-status
 * Body: { singlesId } — cycles outdateddbsnapshotoct2024.singles.status and appends audit row.
 */
/**
 * POST /api/admin/singles/set-status
 * Body: { singlesId, status } — sets outdateddbsnapshotoct2024.singles.status and appends audit row when changed.
 */
export async function postAdminSetSinglesStatus(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  const nextStatus = normalizeSinglesStatus(req.body?.status);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }
  if (!nextStatus) {
    return res.status(400).json({ error: 'status is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT singles_id, member_id, member_category, status, email, phone, alias
       FROM outdateddbsnapshotoct2024.singles
       WHERE singles_id = $1
       LIMIT 1
       FOR UPDATE`,
      [singlesId]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Singles row not found.' });
    }

    const currentStatus = normalizeSinglesStatus(row.status) ?? 'blank';
    if (currentStatus !== nextStatus) {
      await client.query(
        `UPDATE outdateddbsnapshotoct2024.singles
         SET status = $1::outdateddbsnapshotoct2024.singles_status,
             updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $2`,
        [nextStatus, singlesId]
      );

      await recordAuditRegistrationSinglesStatusChange(client, {
        singlesId,
        singlesStatus: nextStatus,
        email: row.email,
        phone: row.phone
      });
    }

    await client.query('COMMIT');
    await invalidateAuthUserCache(singlesId);

    return res.json({
      success: true,
      singles: {
        ...mapSinglesLookupRow({ ...row, status: nextStatus }),
        status: nextStatus
      },
      statusValues: [...SINGLES_STATUS_VALUES]
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[postAdminSetSinglesStatus]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update singles status.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/singles/set-member-category
 * Body: { singlesId, memberCategory } — sets outdateddbsnapshotoct2024.singles.member_category.
 */
export async function postAdminSetSinglesMemberCategory(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  const nextCategory = normalizeMemberCategoryEnum(req.body?.memberCategory ?? req.body?.member_category);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }
  if (!nextCategory) {
    return res.status(400).json({ error: 'memberCategory is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT singles_id, member_id, member_category, status, email, phone, alias
       FROM outdateddbsnapshotoct2024.singles
       WHERE singles_id = $1
       LIMIT 1
       FOR UPDATE`,
      [singlesId]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Singles row not found.' });
    }

    const currentCategory = normalizeMemberCategoryEnum(row.member_category) ?? 'PUBLIC';
    if (currentCategory !== nextCategory) {
      await client.query(
        `UPDATE outdateddbsnapshotoct2024.singles
         SET member_category = $1::outdateddbsnapshotoct2024.member_category_enum,
             updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $2`,
        [nextCategory, singlesId]
      );
    }
    await ensureDemoRegularInitialSetupDone(client, singlesId, nextCategory);

    await client.query('COMMIT');

    return res.json({
      success: true,
      singles: {
        ...mapSinglesLookupRow({ ...row, member_category: nextCategory }),
        memberCategory: nextCategory
      },
      memberCategoryValues: [...MEMBER_CATEGORY_VALUES]
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[postAdminSetSinglesMemberCategory]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update singles member category.' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/singles/reset-password-attempt-count
 * Body: { singlesId } — sets password_attempt_count to 0 on Primary.
 */
export async function postAdminResetPasswordAttemptCount(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowAdminActionOnAccount(res, singlesId))) {
    return;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.singles
       SET password_attempt_count = 0,
           password_attempt_datetime = $2::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1
       RETURNING singles_id, password_attempt_count`,
      [singlesId, PASSWORD_ATTEMPT_EPOCH]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Singles row not found.' });
    }

    return res.json({
      success: true,
      singlesId: Number(rows[0].singles_id),
      passwordAttemptCount: Number(rows[0].password_attempt_count ?? 0)
    });
  } catch (err) {
    console.error('[postAdminResetPasswordAttemptCount]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to reset password attempt count.' });
  }
}

/**
 * POST /api/admin/singles/clear-lock-tuta-notes
 * Body: { singlesId } — admin clears TutaNotes lock after 6 failed Encrypt Password attempts in a row.
 */
export async function postAdminClearLockTutaNotes(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  try {
    const cleared = await clearTutaNotesLock(singlesId);
    await clearVaultAccessFailStatus(singlesId, 'onedrive');
    await clearVaultAccessFailStatus(singlesId, 'usb');
    return res.json({
      success: true,
      singlesId: cleared.singlesId,
      lockTutaNotes: cleared.lockTutaNotes
    });
  } catch (err) {
    console.error('[postAdminClearLockTutaNotes]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to clear TutaNotes lock.' });
  }
}

/**
 * POST /api/admin/singles/clear-lock-tuta-photos
 * Body: { singlesId } — admin clears TutaPhotos lock after 6 failed Encrypt Password attempts in a row.
 */
export async function postAdminClearLockTutaPhotos(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  try {
    const cleared = await clearTutaPhotosLock(singlesId);
    await clearPhotoAlbumsAccessFailStatus(singlesId, 'onedrive');
    await clearPhotoAlbumsAccessFailStatus(singlesId, 'usb');
    return res.json({
      success: true,
      singlesId: cleared.singlesId,
      lockTutaPhotos: cleared.lockTutaPhotos
    });
  } catch (err) {
    console.error('[postAdminClearLockTutaPhotos]', err?.message ?? err);
    return res.status(500).json({ error: err?.message || 'Failed to clear TutaPhotos lock.' });
  }
}

export async function postAdminCycleSinglesStatus(req, res) {
  const singlesId = parseSinglesIdInput(req.body?.singlesId ?? req.body?.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT singles_id, member_id, member_category, status, email, phone, alias
       FROM outdateddbsnapshotoct2024.singles
       WHERE singles_id = $1
       LIMIT 1
       FOR UPDATE`,
      [singlesId]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Singles row not found.' });
    }

    const nextStatus = nextSinglesStatus(row.status);
    await client.query(
      `UPDATE outdateddbsnapshotoct2024.singles
       SET status = $1::outdateddbsnapshotoct2024.singles_status,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2`,
      [nextStatus, singlesId]
    );

    await recordAuditRegistrationSinglesStatusChange(client, {
      singlesId,
      singlesStatus: nextStatus,
      email: row.email,
      phone: row.phone
    });

    await client.query('COMMIT');
    await invalidateAuthUserCache(singlesId);

    return res.json({
      success: true,
      singles: {
        ...mapSinglesLookupRow({ ...row, status: nextStatus }),
        status: nextStatus
      },
      statusValues: [...SINGLES_STATUS_VALUES]
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[postAdminCycleSinglesStatus]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update singles status.' });
  } finally {
    client.release();
  }
}

const SET_FIELDS_UNIQUE_LABELS = {
  singles_email_unique_idx: 'Email',
  singles_phone_unique_idx: 'Phone',
  unique_member_id: 'member_id',
  singles_my_refer_code_uniq: 'My Refer Code'
};

/**
 * Validate admin inline edits → { columns: { col: value }, error? }. Only keys present in body are touched.
 * @param {Record<string, unknown>} body
 */
function parseAdminSinglesFieldEdits(body) {
  const columns = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (has('alias')) {
    const alias = String(body.alias ?? '').trim();
    if (alias.length > 255) return { error: 'Alias must be 255 characters or fewer.' };
    columns.alias = alias || null;
  }
  if (has('email')) {
    const email = normalizeEmailForDb(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
    columns.email = email;
  }
  if (has('phone')) {
    const digits = normalizeUsPhoneDigits(body.phone);
    if (digits.length !== 10) return { error: 'Phone must be a 10-digit US number.' };
    columns.phone = `+1${digits}`;
  }
  if (has('memberId')) {
    const raw = String(body.memberId ?? '').trim();
    if (!/^\d{1,18}$/.test(raw) || Number(raw) < 1) return { error: 'member_id must be a positive whole number.' };
    columns.member_id = raw;
  }
  if (has('myReferCode')) {
    const raw = String(body.myReferCode ?? '').trim();
    const code = normalizeReferByCodeDigits(raw);
    if (raw && !code) return { error: 'My Refer Code must look like A1234.' };
    columns.my_refer_code = code || null;
  }
  if (has('referByCode')) {
    const raw = String(body.referByCode ?? '').trim();
    const code = normalizeReferByCodeDigits(raw);
    if (raw && !code) return { error: 'I refer by must look like A1234.' };
    columns.refer_by_code = code || null;
  }
  return { columns };
}

/**
 * POST /api/admin/singles/set-fields
 * Body: { singlesId, alias?, email?, phone?, memberId?, myReferCode?, referByCode? } — Admin Tools inline edit.
 */
export async function postAdminSinglesSetFields(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const singlesId = parseSinglesIdInput(body.singlesId ?? body.singles_id);
  if (!singlesId) {
    return res.status(400).json({ error: 'singlesId is required.' });
  }
  if (!(await allowSinglesMutationForId(res, singlesId))) {
    return;
  }

  const { columns, error } = parseAdminSinglesFieldEdits(body);
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(columns);
  if (!keys.length) return res.status(400).json({ error: 'No fields to update.' });

  try {
    const { rows: currentRows } = await pool.query(
      `SELECT email FROM outdateddbsnapshotoct2024.singles WHERE singles_id = $1`,
      [singlesId]
    );
    if (!currentRows.length) return res.status(404).json({ error: 'Singles row not found.' });
    if (columns.email !== undefined && columns.email !== normalizeEmailForDb(currentRows[0].email)) {
      if (isProtectedAccountEmail(currentRows[0].email)) {
        return res.status(403).json({ error: 'Protected account (PROTECT_ACCOUNTS) — email cannot be changed.' });
      }
    }

    const setSql = keys.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE outdateddbsnapshotoct2024.singles
       SET ${setSql}, updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1
       RETURNING singles_id`,
      [singlesId, ...keys.map((col) => columns[col])]
    );
    if (!rows.length) return res.status(404).json({ error: 'Singles row not found.' });

    await invalidateAuthUserCache(singlesId);
    return res.json({ success: true, singlesId, updated: keys });
  } catch (err) {
    if (err?.code === '23505') {
      const label = SET_FIELDS_UNIQUE_LABELS[err.constraint] || 'That value';
      return res.status(409).json({ error: `${label} is already used by another member.` });
    }
    console.error('[postAdminSinglesSetFields]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update singles fields.' });
  }
}
