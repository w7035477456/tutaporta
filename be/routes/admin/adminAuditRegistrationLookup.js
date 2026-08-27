import pool from '../../db/connection.js';
import { allowSinglesMutationForId } from '../../utils/systemToolsAdmin.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
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

const SINGLES_LOOKUP_WILDCARD_LIMIT = 500;

const SINGLES_LOOKUP_FROM_JOIN = `FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.singles ref
       ON btrim(COALESCE(ref.my_refer_code::text, '')) = btrim(COALESCE(s.refer_by_code::text, ''))
      AND btrim(COALESCE(s.refer_by_code::text, '')) <> ''
     LEFT JOIN LATERAL (
       SELECT p.account_balance_token
       FROM helloworldjunktest.payment p
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
            s.my_refer_code,
            s.refer_by_code,
            s.profile_image_fk,
            ref.singles_id AS refer_by_singles_id,
            COALESCE(bal.account_balance_token, 0) AS account_balance_token
     ${SINGLES_LOOKUP_FROM_JOIN}`;

function parseSinglesIdInput(raw) {
  const parsed = parseSinglesIdLookup(raw);
  return parsed?.mode === 'exact' ? parsed.value : null;
}

function hasLookupInput(body) {
  return hasAdminLookupInput(body);
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
     FROM helloworldjunktest.audit_registrations ar
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
  return {
    singlesId: Number(row.singles_id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    memberCategory: String(row.member_category ?? ''),
    status: String(row.status ?? 'blank'),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    alias: String(row.alias ?? ''),
    profileImageFk: Number.isFinite(profileImageFk) && profileImageFk > 0 ? profileImageFk : null,
    accountBalanceToken: Number.isFinite(rawTokenBalance) ? Math.trunc(rawTokenBalance) : 0,
    passwordAttemptCount:
      row.password_attempt_count != null && Number.isFinite(Number(row.password_attempt_count))
        ? Number(row.password_attempt_count)
        : 0,
    myReferCode: String(row.my_refer_code ?? '').trim(),
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

  if (!conditions.length) {
    return [];
  }

  const limitClause = lookupUsesWildcard(body) ? ` LIMIT ${SINGLES_LOOKUP_WILDCARD_LIMIT}` : '';

  const { rows } = await db.query(
    `${SINGLES_LOOKUP_SELECT}
     WHERE ${conditions.join(' OR ')}
     ORDER BY s.singles_id ASC${limitClause}`,
    params
  );

  return rows;
}

/** All singles rows for Admin Tools → Lookup All (ORDER BY singles_id). */
export async function searchAllSinglesForLookup(db) {
  const { rows } = await db.query(`${SINGLES_LOOKUP_SELECT}
     ORDER BY s.singles_id ASC`);
  return rows;
}

/**
 * POST /api/admin/singles/lookup-all
 * Returns all helloworldjunktest.singles rows sorted by singles_id.
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
 * Body: { singlesId?, email?, alias?, memberId?, phone? }
 */
export async function postAdminAuditRegistrationLookup(req, res) {
  try {
    if (!hasLookupInput(req.body)) {
      return res.status(400).json({ error: 'Enter Single Id, Email, Alias, Member Id, or Phone.' });
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
 * Body: { singlesId } — cycles helloworldjunktest.singles.status and appends audit row.
 */
/**
 * POST /api/admin/singles/set-status
 * Body: { singlesId, status } — sets helloworldjunktest.singles.status and appends audit row when changed.
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
       FROM helloworldjunktest.singles
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
        `UPDATE helloworldjunktest.singles
         SET status = $1::helloworldjunktest.singles_status,
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
 * Body: { singlesId, memberCategory } — sets helloworldjunktest.singles.member_category.
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
       FROM helloworldjunktest.singles
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
        `UPDATE helloworldjunktest.singles
         SET member_category = $1::helloworldjunktest.member_category_enum,
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

  try {
    const { rows } = await pool.query(
      `UPDATE helloworldjunktest.singles
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
       FROM helloworldjunktest.singles
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
      `UPDATE helloworldjunktest.singles
       SET status = $1::helloworldjunktest.singles_status,
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
