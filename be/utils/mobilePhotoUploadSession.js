import crypto from 'crypto';
import pool from '../db/connection.js';
import { getPublicAppUrl } from './publicAppUrl.js';
import { getDBSchema } from '../config/envConfig.js';
import { debugMobilePhotoUpload, maskMobileUploadToken } from './mobilePhotoUploadLog.js';

/** ~/.ssh/be/.env BARCODE_RENEW_MINUTES — phone QR session lifetime (default 30). */
function getBarcodeRenewMinutes() {
  const parsed = Number(String(process.env.BARCODE_RENEW_MINUTES ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.floor(parsed), 24 * 60);
}
const REDIS_SESSION_PREFIX = 'v1:mobilePhotoUpload:';
export const MOBILE_PHOTO_UPLOAD_PATH = '/mobilePhotoUpload';

const PURPOSE_PROFILE = 'profile';
const PURPOSE_PHOTO_ALBUMS = 'photo_albums';
const PURPOSE_BILL_RECEIPT = 'bill_receipt';

export function normalizeMobilePhotoUploadPurpose(raw) {
  const p = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (p === PURPOSE_PHOTO_ALBUMS || p === 'photoalbums' || p === 'albums') {
    return PURPOSE_PHOTO_ALBUMS;
  }
  if (p === PURPOSE_BILL_RECEIPT || p === 'bill' || p === 'bill_receipts' || p === 'receipt') {
    return PURPOSE_BILL_RECEIPT;
  }
  return PURPOSE_PROFILE;
}

export function isBillReceiptUploadPurpose(purpose) {
  return normalizeMobilePhotoUploadPurpose(purpose) === PURPOSE_BILL_RECEIPT;
}

let redisClient = null;

/** Shared centralized Redis from server_be (cross-server session lookup). */
export function setMobilePhotoUploadRedis(client) {
  redisClient = client || null;
}

function normalizeUploadToken(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, '');
}

export function readMobilePhotoUploadTokenFromRequest(req) {
  return normalizeUploadToken(req.query?.token ?? req.params?.token ?? '');
}

function sessionRowFromCache(raw) {
  if (!raw) return null;
  try {
    const row = JSON.parse(raw);
    if (!row?.token) return null;
    return row;
  } catch {
    return null;
  }
}

async function saveSessionToRedis(row) {
  if (!redisClient || !row?.token) return;
  try {
    const ttlMs = new Date(row.expires_at).getTime() - Date.now();
    const ttlSec = Math.max(60, Math.ceil(ttlMs / 1000) + 120);
    await redisClient.setex(`${REDIS_SESSION_PREFIX}${row.token}`, ttlSec, JSON.stringify(row));
    debugMobilePhotoUpload('redis cache SET', { token: maskMobileUploadToken(row.token), ttlSec });
  } catch (err) {
    debugMobilePhotoUpload('redis cache SET failed', { message: err?.message ?? err });
  }
}

async function loadSessionFromRedis(token) {
  if (!redisClient) return null;
  try {
    const raw = await redisClient.get(`${REDIS_SESSION_PREFIX}${token}`);
    const row = sessionRowFromCache(raw);
    if (row) {
      debugMobilePhotoUpload('redis cache HIT', { token: maskMobileUploadToken(token) });
    }
    return row;
  } catch (err) {
    debugMobilePhotoUpload('redis cache GET failed', { message: err?.message ?? err });
    return null;
  }
}

async function invalidateSessionInRedis(token) {
  if (!redisClient || !token) return;
  try {
    await redisClient.del(`${REDIS_SESSION_PREFIX}${token}`);
  } catch {
    // ignore
  }
}

function sessionsTable() {
  const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return `"${schema}"."mobile_photo_upload_sessions"`;
}

export function buildMobilePhotoUploadPageUrl(token) {
  let base = getPublicAppUrl().replace(/\/$/, '');
  try {
    const parsed = new URL(base);
    parsed.hostname = parsed.hostname.toLowerCase();
    base = parsed.origin;
  } catch {
    // keep base as configured
  }
  // Path token (not ?token=) — fewer Cloudflare OWASP false positives on phone scans.
  return `${base}${MOBILE_PHOTO_UPLOAD_PATH}/u/${encodeURIComponent(token)}`;
}

export async function createMobilePhotoUploadSession(
  singlesId,
  { purpose: purposeRaw, paidRecordId: paidRecordIdRaw } = {}
) {
  await ensureMobilePhotoUploadSchema();
  const purpose = normalizeMobilePhotoUploadPurpose(purposeRaw);
  const paidRecordId =
    purpose === PURPOSE_BILL_RECEIPT ? Number(paidRecordIdRaw) : null;
  if (purpose === PURPOSE_BILL_RECEIPT) {
    if (!Number.isFinite(paidRecordId) || paidRecordId < 1) {
      throw new Error('paid_record_id is required for bill_receipt uploads');
    }
  }
  const token = crypto.randomBytes(24).toString('hex');
  const renewMinutes = getBarcodeRenewMinutes();
  const expiresAt = new Date(Date.now() + renewMinutes * 60 * 1000);
  debugMobilePhotoUpload('create session START', {
    singlesId,
    purpose,
    paidRecordId,
    token: maskMobileUploadToken(token),
    expiresAt: expiresAt.toISOString(),
    renewMinutes,
    publicAppUrl: getPublicAppUrl()
  });
  await pool.query(
    `INSERT INTO ${sessionsTable()} (token, singles_id, expires_at, purpose, paid_record_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [token, singlesId, expiresAt, purpose, Number.isFinite(paidRecordId) ? paidRecordId : null]
  );
  const insertedRow = {
    token,
    singles_id: singlesId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    photos_id: null,
    completed_at: null,
    replaced_duplicate: false,
    purpose,
    stored_file_name: null,
    paid_record_id: Number.isFinite(paidRecordId) ? paidRecordId : null
  };
  await saveSessionToRedis(insertedRow);
  const verify = await getMobilePhotoUploadSession(token);
  if (!verify) {
    debugMobilePhotoUpload('create session VERIFY FAILED — row not readable after insert', {
      singlesId,
      token: maskMobileUploadToken(token)
    });
    throw new Error('Mobile upload session was created but could not be read back. Check database connectivity.');
  }
  const mobileUrl = buildMobilePhotoUploadPageUrl(token);
  debugMobilePhotoUpload('create session OK', {
    singlesId,
    purpose,
    token: maskMobileUploadToken(token),
    mobileUrlHost: (() => {
      try {
        return new URL(mobileUrl).host;
      } catch {
        return '(invalid url)';
      }
    })()
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    renewMinutes,
    mobileUrl,
    purpose,
    paidRecordId: Number.isFinite(paidRecordId) ? paidRecordId : null
  };
}

export async function getMobilePhotoUploadSession(token) {
  await ensureMobilePhotoUploadSchema();
  const trimmed = normalizeUploadToken(token);
  if (!trimmed) {
    debugMobilePhotoUpload('get session SKIP empty token');
    return null;
  }
  const cached = await loadSessionFromRedis(trimmed);
  if (cached) {
    return cached;
  }
  const { rows } = await pool.query(
    `SELECT token, singles_id, created_at, expires_at, photos_id, completed_at, replaced_duplicate,
            purpose, stored_file_name, paid_record_id
     FROM ${sessionsTable()}
     WHERE token = $1
     LIMIT 1`,
    [trimmed]
  );
  const row = rows[0] || null;
  if (row) {
    await saveSessionToRedis(row);
  }
  debugMobilePhotoUpload('get session', {
    token: maskMobileUploadToken(trimmed),
    found: Boolean(row),
    singlesId: row?.singles_id ?? null,
    photosId: row?.photos_id ?? null,
    purpose: row?.purpose ?? null,
    storedFileName: row?.stored_file_name ?? null,
    completed: Boolean(row?.completed_at),
    expired: row ? sessionExpired(row) : null,
    expiresAt: row?.expires_at ?? null
  });
  return row;
}

export function sessionExpired(row) {
  if (!row) return true;
  return new Date(row.expires_at).getTime() <= Date.now();
}

/** Record latest phone upload on this session (same QR/token may be reused until expires_at). */
export async function markMobilePhotoUploadCompleted(
  token,
  photosId,
  { replacedDuplicate = false, storedFileName } = {}
) {
  const fileName =
    storedFileName == null || storedFileName === ''
      ? null
      : String(storedFileName);
  debugMobilePhotoUpload('mark completed START', {
    token: maskMobileUploadToken(token),
    photosId,
    replacedDuplicate,
    storedFileName: fileName
  });
  await pool.query(
    `UPDATE ${sessionsTable()}
     SET photos_id = $2,
         completed_at = NOW(),
         replaced_duplicate = $3,
         stored_file_name = COALESCE($4, stored_file_name)
     WHERE token = $1`,
    [token, photosId, Boolean(replacedDuplicate), fileName]
  );
  await invalidateSessionInRedis(token);
  await getMobilePhotoUploadSession(token);
  debugMobilePhotoUpload('mark completed OK', {
    token: maskMobileUploadToken(token),
    photosId,
    storedFileName: fileName
  });
}

let mobileUploadSchemaPromise = null;

/** Ensure mobile_photo_upload_sessions exists (startup + first request). */
export async function initMobilePhotoUploadSchema() {
  if (mobileUploadSchemaPromise) return mobileUploadSchemaPromise;
  mobileUploadSchemaPromise = (async () => {
    const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."mobile_photo_upload_sessions" (
        token text PRIMARY KEY,
        singles_id integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        photos_id integer,
        completed_at timestamptz,
        replaced_duplicate boolean NOT NULL DEFAULT false,
        purpose text NOT NULL DEFAULT 'profile',
        stored_file_name text
      )
    `);
    await pool.query(`
      ALTER TABLE "${schema}"."mobile_photo_upload_sessions"
        ADD COLUMN IF NOT EXISTS replaced_duplicate boolean NOT NULL DEFAULT false
    `);
    await pool.query(`
      ALTER TABLE "${schema}"."mobile_photo_upload_sessions"
        ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'profile'
    `);
    await pool.query(`
      ALTER TABLE "${schema}"."mobile_photo_upload_sessions"
        ADD COLUMN IF NOT EXISTS stored_file_name text
    `);
    await pool.query(`
      ALTER TABLE "${schema}"."mobile_photo_upload_sessions"
        ADD COLUMN IF NOT EXISTS paid_record_id bigint NULL
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS mobile_photo_upload_sessions_expires_idx
        ON "${schema}"."mobile_photo_upload_sessions" (expires_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS mobile_photo_upload_sessions_singles_created_idx
        ON "${schema}"."mobile_photo_upload_sessions" (singles_id, created_at DESC)
    `);
    debugMobilePhotoUpload('schema ready', { schema });
  })().catch((err) => {
    mobileUploadSchemaPromise = null;
    throw err;
  });
  return mobileUploadSchemaPromise;
}

async function ensureMobilePhotoUploadSchema() {
  return initMobilePhotoUploadSchema();
}
