import pool from '../../db/connection.js';
import {
  appendEmailCondition,
  appendPhoneCondition,
  hasWildcard,
  parseEmailLookup,
  parsePhoneLookup,
  parseSinglesIdLookup,
  wildcardToLikePattern
} from '../../utils/adminLookupWildcard.js';
import { formatLoginLogIpForDisplay, lastDigitOfIp } from '../../utils/loginLog.js';

const LOGIN_LOG_LIMIT = 2000;
const LIKE_ESCAPE = ` ESCAPE '\\'`;

/**
 * Map UI / free-text Type filter → SQL predicates.
 * Accepts: demo, Demo, demo_login, signup, Signup (and * wildcards).
 * @returns {{ mode: 'demo' } | { mode: 'signup' } | { mode: 'like', pattern: string } | null}
 */
function parseTypeLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (hasWildcard(trimmed)) {
    const pattern = wildcardToLikePattern(trimmed.toLowerCase()) ?? (trimmed === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === 'demo' || normalized === 'demo_login') return { mode: 'demo' };
  if (normalized === 'signup' || normalized === 'sign_up' || normalized === 'sign-up') {
    return { mode: 'signup' };
  }
  return { mode: 'like', pattern: wildcardToLikePattern(`*${normalized}*`) || `%${normalized}%` };
}

/**
 * @returns {{ mode: 'exact', value: string } | { mode: 'like', pattern: string } | null}
 */
function parseIpLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (hasWildcard(trimmed)) {
    const pattern = wildcardToLikePattern(trimmed) ?? (trimmed === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  return { mode: 'exact', value: trimmed };
}

function hasLoginLogLookupInput(body) {
  return Boolean(
    parseTypeLookup(body?.type ?? body?.eventType ?? body?.event_type) ||
      parseSinglesIdLookup(body?.singlesId ?? body?.singles_id) ||
      parseEmailLookup(body?.email) ||
      parsePhoneLookup(body?.phone ?? body?.number) ||
      parseIpLookup(body?.ip ?? body?.clientIp ?? body?.client_ip)
  );
}

function displayTypeLabel(row) {
  if (row?.is_demo === true || String(row?.event_type ?? '') === 'demo_login') return 'Demo';
  if (String(row?.event_type ?? '') === 'signup') return 'Signup';
  return String(row?.event_type ?? '—');
}

function mapLoginLogRow(row) {
  return {
    loginLogId: Number(row.login_log_id),
    eventType: String(row.event_type ?? ''),
    isDemo: row.is_demo === true,
    typeLabel: displayTypeLabel(row),
    singlesId: row.singles_id != null && Number.isFinite(Number(row.singles_id)) ? Number(row.singles_id) : null,
    memberId: row.member_id != null && Number.isFinite(Number(row.member_id)) ? Number(row.member_id) : null,
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    clientIp: formatLoginLogIpForDisplay(row.client_ip),
    loginAt: row.login_at,
    logoutAt: row.logout_at,
    onlineSeconds:
      row.online_seconds != null && Number.isFinite(Number(row.online_seconds))
        ? Number(row.online_seconds)
        : null,
    logoutReason: row.logout_reason != null ? String(row.logout_reason) : ''
  };
}

function buildLoginLogWhere(body, { requireInput }) {
  const typeLookup = parseTypeLookup(body?.type ?? body?.eventType ?? body?.event_type);
  const singlesIdLookup = parseSinglesIdLookup(body?.singlesId ?? body?.singles_id);
  const emailLookup = parseEmailLookup(body?.email);
  const phoneLookup = parsePhoneLookup(body?.phone ?? body?.number);
  const ipLookup = parseIpLookup(body?.ip ?? body?.clientIp ?? body?.client_ip);

  if (requireInput && !hasLoginLogLookupInput(body)) {
    return { error: 'Enter Type, ID, Email, Number, or IP.' };
  }

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (typeLookup?.mode === 'demo') {
    conditions.push(`(ll.is_demo = true OR ll.event_type = 'demo_login'::helloworldjunktest.login_log_event_type)`);
  } else if (typeLookup?.mode === 'signup') {
    conditions.push(`ll.event_type = 'signup'::helloworldjunktest.login_log_event_type`);
  } else if (typeLookup?.mode === 'like') {
    conditions.push(
      `(CASE
          WHEN ll.is_demo OR ll.event_type = 'demo_login' THEN 'demo'
          WHEN ll.event_type = 'signup' THEN 'signup'
          ELSE ll.event_type::text
        END) LIKE $${paramIndex}${LIKE_ESCAPE}`
    );
    params.push(typeLookup.pattern);
    paramIndex += 1;
  }

  if (singlesIdLookup?.mode === 'exact') {
    conditions.push(`ll.singles_id = $${paramIndex}`);
    params.push(singlesIdLookup.value);
    paramIndex += 1;
  } else if (singlesIdLookup?.mode === 'like') {
    conditions.push(`ll.singles_id::text LIKE $${paramIndex}${LIKE_ESCAPE}`);
    params.push(singlesIdLookup.pattern);
    paramIndex += 1;
  }

  paramIndex = appendEmailCondition(conditions, params, emailLookup, paramIndex, 'll.email');
  paramIndex = appendPhoneCondition(conditions, params, phoneLookup, paramIndex, 'll.phone');

  if (ipLookup?.mode === 'exact') {
    const digit = lastDigitOfIp(ipLookup.value);
    if (digit) {
      conditions.push(`right(regexp_replace(ll.client_ip::text, '[^0-9]', '', 'g'), 1) = $${paramIndex}`);
      params.push(digit);
      paramIndex += 1;
    } else {
      conditions.push(`ll.client_ip::text = $${paramIndex}`);
      params.push(ipLookup.value);
      paramIndex += 1;
    }
  } else if (ipLookup?.mode === 'like') {
    conditions.push(`ll.client_ip::text LIKE $${paramIndex}${LIKE_ESCAPE}`);
    params.push(ipLookup.pattern);
    paramIndex += 1;
  }

  return { conditions, params };
}

async function queryLoginLog({ conditions, params, limit }) {
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitSql = Number.isFinite(limit) && limit > 0 ? ` LIMIT ${Math.trunc(limit)}` : '';
  const { rows } = await pool.query(
    `SELECT ll.login_log_id,
            ll.event_type,
            ll.is_demo,
            ll.singles_id,
            s.member_id,
            ll.email,
            ll.phone,
            ll.client_ip,
            ll.login_at,
            ll.logout_at,
            ll.online_seconds,
            ll.logout_reason
     FROM helloworldjunktest.login_log ll
     LEFT JOIN helloworldjunktest.singles s ON s.singles_id = ll.singles_id
     ${whereSql}
     ORDER BY ll.login_at DESC, ll.login_log_id DESC${limitSql}`,
    params
  );
  return rows.map(mapLoginLogRow);
}

/**
 * POST /api/admin/login-log/lookup
 * Body: { type?, singlesId?, email?, phone?/number?, ip? }
 */
export async function postAdminLoginLogLookup(req, res) {
  try {
    const built = buildLoginLogWhere(req.body, { requireInput: true });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }
    const rows = await queryLoginLog({
      conditions: built.conditions,
      params: built.params,
      limit: LOGIN_LOG_LIMIT
    });
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error('[postAdminLoginLogLookup]', err?.message ?? err);
    if (err?.code === '42P01') {
      return res.status(500).json({
        error: 'login_log table is missing. Run be/db/addLoginLog.sql on Primary.'
      });
    }
    return res.status(500).json({ error: 'Failed to lookup login log.' });
  }
}

/**
 * POST /api/admin/login-log/lookup-all
 * Returns recent login_log rows (newest first).
 */
export async function postAdminLoginLogLookupAll(req, res) {
  try {
    const rows = await queryLoginLog({
      conditions: [],
      params: [],
      limit: LOGIN_LOG_LIMIT
    });
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error('[postAdminLoginLogLookupAll]', err?.message ?? err);
    if (err?.code === '42P01') {
      return res.status(500).json({
        error: 'login_log table is missing. Run be/db/addLoginLog.sql on Primary.'
      });
    }
    return res.status(500).json({ error: 'Failed to lookup all login log rows.' });
  }
}
