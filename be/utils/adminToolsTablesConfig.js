/** Admin Tools → Tables tab: curated helloworldjunktest tables (see sql/postLinkingSome06182026.sql). */

export const ADMIN_TOOLS_DB_SCHEMA = 'helloworldjunktest';

/**
 * @typedef {'bigint' | 'text'} AdminToolsTableIdType
 * @typedef {{ key: string, table: string, label: string, idColumn: string, idType?: AdminToolsTableIdType, partitioned?: boolean }} AdminToolsTableDef
 */

/** @type {AdminToolsTableDef[]} */
export const ADMIN_TOOLS_TABLES = [
  { key: 'singles', table: 'singles', label: 'singles', idColumn: 'singles_id', idType: 'bigint' },
  { key: 'photos', table: 'photos', label: 'photos', idColumn: 'photos_id', idType: 'bigint' },
  { key: 'videos', table: 'videos', label: 'Videos', idColumn: 'video_id', idType: 'bigint' },
  { key: 'postings', table: 'postings', label: 'postings', idColumn: 'post_id', idType: 'bigint', partitioned: true },
  { key: 'posting_photos', table: 'posting_photos', label: 'posting_photos', idColumn: 'photo_id', idType: 'bigint', partitioned: true },
  { key: 'posting_comments', table: 'posting_comments', label: 'posting_comments', idColumn: 'comment_id', idType: 'bigint', partitioned: true },
  { key: 'chat_log', table: 'chat_log', label: 'chat_log', idColumn: 'msg_id', idType: 'bigint', partitioned: true },
  { key: 'payment', table: 'payment', label: 'Payments', idColumn: 'payment_id', idType: 'bigint' },
  { key: 'vet_bio', table: 'vet_bio', label: 'vet_bio', idColumn: 'vet_bio_id', idType: 'bigint' },
  { key: 'verifications', table: 'verifications', label: 'verifications', idColumn: 'id', idType: 'bigint' },
  { key: 'requests', table: 'requests', label: 'requests', idColumn: 'requests_id', idType: 'bigint' },
  { key: 'florist_orders', table: 'florist_orders', label: 'florist_orders', idColumn: 'id', idType: 'bigint' },
  { key: 'gift_transactions', table: 'gift_transactions', label: 'gift_transactions', idColumn: 'id', idType: 'bigint' },
  { key: 'consent_record', table: 'consent_record', label: 'Consent_record', idColumn: 'consent_record_id', idType: 'bigint' },
  { key: 'pending_paypal_orders', table: 'pending_paypal_orders', label: 'pending_paypal_orders', idColumn: 'singles_id', idType: 'bigint' },
  {
    key: 'mobile_photo_upload_sessions',
    table: 'mobile_photo_upload_sessions',
    label: 'Mobile_photo_upload_sessions',
    idColumn: 'token',
    idType: 'text'
  },
  { key: 'audit_registrations', table: 'audit_registrations', label: 'audit_registrations', idColumn: 'audit_registration_id', idType: 'bigint' }
];

const TABLE_BY_KEY = new Map(ADMIN_TOOLS_TABLES.map((def) => [def.key, def]));

export function resolveAdminToolsTable(key) {
  const k = String(key ?? '').trim();
  return TABLE_BY_KEY.get(k) ?? null;
}

export function quoteSqlIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

export function qualifiedAdminTableSql(def) {
  return `${quoteSqlIdent(ADMIN_TOOLS_DB_SCHEMA)}.${quoteSqlIdent(def.table)}`;
}

/**
 * @param {unknown} raw
 * @param {AdminToolsTableDef} def
 */
export function normalizeAdminToolsTableId(raw, def) {
  if (def.idType === 'text') {
    const value = String(raw ?? '').trim();
    return value || null;
  }
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}
