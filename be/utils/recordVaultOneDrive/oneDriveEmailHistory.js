import pool from '../../db/connection.js';
import { getSingleLoginRedis } from '../singleLoginSession.js';

/** Cluster-wide cache — shared Redis (same REDIS_URL as single-login sessions). */
export const ONEDRIVE_EMAILS_KEY_PREFIX = 'v1:onedrive:emails:';

/** Refreshed on read; invalidated on remember / connection save / clear. */
const CACHE_TTL_SEC = 35 * 24 * 3600;

export function oneDriveEmailsRedisKey(singlesId) {
  const id = Math.trunc(Number(singlesId));
  return `${ONEDRIVE_EMAILS_KEY_PREFIX}${id}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function dedupeEmailsCaseInsensitive(emails) {
  const seen = new Set();
  const out = [];
  for (const raw of emails) {
    const value = String(raw || '').trim();
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function parsePostgresTextArrayLiteral(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '{}') return [];
  if (!text.startsWith('{') || !text.endsWith('}')) return [];
  const content = text.slice(1, -1);
  if (!content) return [];

  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      const item = current.trim();
      if (item) out.push(item.replace(/^"(.*)"$/, '$1'));
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) out.push(last.replace(/^"(.*)"$/, '$1'));
  return out;
}

function coerceOneDriveEmailArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => String(raw[key] ?? '').trim())
      .filter(Boolean);
  }
  return parsePostgresTextArrayLiteral(raw);
}

/**
 * @returns {Promise<string[]|undefined>} undefined = Redis miss/unavailable
 */
async function getCachedOneDriveEmailsPicker(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return undefined;
  try {
    const raw = await redis.get(oneDriveEmailsRedisKey(id));
    if (raw === null) return undefined;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.emails)) return undefined;
    return dedupeEmailsCaseInsensitive(parsed.emails);
  } catch {
    return undefined;
  }
}

async function setCachedOneDriveEmailsPicker(singlesId, emails) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.set(
      oneDriveEmailsRedisKey(id),
      JSON.stringify({ emails: dedupeEmailsCaseInsensitive(emails || []) }),
      'EX',
      CACHE_TTL_SEC
    );
  } catch {
    // Redis down — Postgres remains source of truth
  }
}

export async function invalidateCachedOneDriveEmails(singlesId) {
  const redis = getSingleLoginRedis();
  const id = Math.trunc(Number(singlesId));
  if (!redis || !Number.isFinite(id) || id < 1) return;
  try {
    await redis.del(oneDriveEmailsRedisKey(id));
  } catch {
    // ignore
  }
}

export async function loadOneDriveEmails(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT btrim(e) AS email
       FROM helloworldjunktest.singles s
       CROSS JOIN LATERAL unnest(COALESCE(s.onedrive_emails, ARRAY[]::text[])) AS e
      WHERE s.singles_id = $1
        AND btrim(e) <> ''
      ORDER BY email`,
    [id]
  );
  const fromUnnest = rows.map((row) => String(row?.email || '').trim()).filter(Boolean);
  if (fromUnnest.length) {
    return dedupeEmailsCaseInsensitive(fromUnnest);
  }

  const { rows: fallbackRows } = await pool.query(
    `SELECT onedrive_emails::text AS onedrive_emails_text
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  const raw = fallbackRows[0]?.onedrive_emails_text ?? fallbackRows[0]?.onedrive_emails;
  return dedupeEmailsCaseInsensitive(coerceOneDriveEmailArray(raw));
}

async function readOneDriveEmailsForPickerFromDb(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return [];

  const { rows } = await pool.query(
    `SELECT onedrive_emails::text AS onedrive_emails_text,
            record_notes_onedrive_email
       FROM helloworldjunktest.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return [];

  const saved = dedupeEmailsCaseInsensitive(coerceOneDriveEmailArray(row.onedrive_emails_text));
  const connected = normalizeEmail(row.record_notes_onedrive_email);
  if (!connected) return saved;
  if (saved.some((entry) => entry.toLowerCase() === connected)) return saved;
  return [String(row.record_notes_onedrive_email).trim(), ...saved];
}

export async function loadOneDriveEmailsForPicker(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return [];

  const cached = await getCachedOneDriveEmailsPicker(id);
  if (cached !== undefined) return cached;

  const emails = await readOneDriveEmailsForPickerFromDb(id);
  await setCachedOneDriveEmailsPicker(id, emails);
  return emails;
}

export async function rememberOneDriveEmail(singlesId, email) {
  const id = Number(singlesId);
  const normalized = normalizeEmail(email);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  if (!normalized) {
    throw new Error('Email is required');
  }
  const existing = await loadOneDriveEmails(id);
  if (existing.some((entry) => entry.toLowerCase() === normalized)) {
    return { emails: existing, added: false };
  }
  const next = dedupeEmailsCaseInsensitive([...existing, String(email).trim()]);
  await pool.query(
    `UPDATE helloworldjunktest.singles
        SET onedrive_emails = $2
      WHERE singles_id = $1`,
    [id, next]
  );
  await invalidateCachedOneDriveEmails(id);
  return { emails: next, added: true };
}
