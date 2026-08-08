/** Admin Tools → Wipe by Id: per-table count/delete by singles_id (non-cascade). */

import { ADMIN_TOOLS_DB_SCHEMA, quoteSqlIdent } from './adminToolsTablesConfig.js';

const SCHEMA = quoteSqlIdent(ADMIN_TOOLS_DB_SCHEMA);

/**
 * @typedef {object} AdminWipeBySinglesIdTableDef
 * @property {string} key
 * @property {string} label
 * @property {string} table — qualified schema.table for display
 * @property {(singlesId: number) => string} countSql — must return column `n`
 * @property {() => string} allCountSql — total rows (no singles_id filter); must return column `n`
 * @property {(singlesId: number) => string} deleteSql
 * @property {(singlesId: number) => string} [cascadeDeleteSql]
 */

/** @type {AdminWipeBySinglesIdTableDef[]} */
export const ADMIN_WIPE_BY_SINGLES_ID_TABLES = [
  {
    key: 'singles',
    label: 'singles',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.singles`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.singles WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.singles`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.singles WHERE singles_id = $1`
  },
  {
    key: 'postings',
    label: 'postings',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.postings`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.postings WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.postings`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.postings WHERE singles_id = $1`
  },
  {
    key: 'posting_photos',
    label: 'posting_photos',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.posting_photos`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.posting_photos pp
       INNER JOIN ${SCHEMA}.postings p ON p.post_id = pp.post_id
       WHERE p.singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.posting_photos`,
    deleteSql: () =>
      `DELETE FROM ${SCHEMA}.posting_photos pp
       USING ${SCHEMA}.postings p
       WHERE pp.post_id = p.post_id
         AND p.singles_id = $1`,
    cascadeDeleteSql: () => `DELETE FROM ${SCHEMA}.postings WHERE singles_id = $1`
  },
  {
    key: 'posting_comments',
    label: 'posting_comments',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.posting_comments`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.posting_comments
       WHERE author_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.posting_comments`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.posting_comments WHERE author_id = $1`
  },
  {
    key: 'chat_log',
    label: 'chat_log',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.chat_log`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.chat_log
       WHERE sender_id = $1 OR receiver_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.chat_log`,
    deleteSql: () =>
      `DELETE FROM ${SCHEMA}.chat_log
       WHERE sender_id = $1 OR receiver_id = $1`
  },
  {
    key: 'photos',
    label: 'Photos',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.photos`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.photos WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.photos`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.photos WHERE singles_id = $1`
  },
  {
    key: 'videos',
    label: 'Videos',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.videos`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.videos WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.videos`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.videos WHERE singles_id = $1`
  },
  {
    key: 'vet_bio',
    label: 'vet_bio',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.vet_bio`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.vet_bio WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.vet_bio`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.vet_bio WHERE singles_id = $1`
  },
  {
    key: 'misc_bio',
    label: 'Misc_bio',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.misc_bio`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.misc_bio WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.misc_bio`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.misc_bio WHERE singles_id = $1`
  },
  {
    key: 'requests',
    label: 'requests',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.requests`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.requests
       WHERE singles_id_from = $1 OR singles_id_to = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.requests`,
    deleteSql: () =>
      `DELETE FROM ${SCHEMA}.requests
       WHERE singles_id_from = $1 OR singles_id_to = $1`
  },
  {
    key: 'audit_registrations',
    label: 'audit_registrations',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.audit_registrations`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.audit_registrations WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.audit_registrations`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.audit_registrations WHERE singles_id = $1`
  },
  {
    key: 'consent_record',
    label: 'Consent_record',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.consent_record`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.consent_record WHERE member_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.consent_record`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.consent_record WHERE member_id = $1`
  },
  {
    key: 'user_customization',
    label: 'user_customization',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.user_customization`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.user_customization WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.user_customization`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.user_customization WHERE singles_id = $1`
  },
  {
    key: 'mobile_photo_upload_sessions',
    label: 'Mobile_photo_upload_sessions',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.mobile_photo_upload_sessions`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.mobile_photo_upload_sessions WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.mobile_photo_upload_sessions`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.mobile_photo_upload_sessions WHERE singles_id = $1`
  },
  {
    key: 'payment',
    label: 'Payments',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.payment`,
    countSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.payment WHERE singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.payment`,
    deleteSql: () => `DELETE FROM ${SCHEMA}.payment WHERE singles_id = $1`
  },
  {
    key: 'florist_orders',
    label: 'florist_orders',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.florist_orders`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.florist_orders
       WHERE sender_singles_id = $1 OR receiver_singles_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.florist_orders`,
    deleteSql: () =>
      `DELETE FROM ${SCHEMA}.florist_orders
       WHERE sender_singles_id = $1 OR receiver_singles_id = $1`
  },
  {
    key: 'gift_transactions',
    label: 'gift_transactions',
    table: `${ADMIN_TOOLS_DB_SCHEMA}.gift_transactions`,
    countSql: () =>
      `SELECT COUNT(*)::bigint AS n
       FROM ${SCHEMA}.gift_transactions
       WHERE singles_id = $1 OR recipient_id = $1`,
    allCountSql: () => `SELECT COUNT(*)::bigint AS n FROM ${SCHEMA}.gift_transactions`,
    deleteSql: () =>
      `DELETE FROM ${SCHEMA}.gift_transactions
       WHERE singles_id = $1 OR recipient_id = $1`
  }
];

const TABLE_BY_KEY = new Map(ADMIN_WIPE_BY_SINGLES_ID_TABLES.map((def) => [def.key, def]));

export function resolveAdminWipeBySinglesIdTable(key) {
  const k = String(key ?? '').trim();
  return TABLE_BY_KEY.get(k) ?? null;
}

export function parseAdminWipeSinglesId(raw) {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** @returns {{ mode: 'all' } | { mode: 'singles', singlesId: number } | null} */
export function parseAdminWipeSearchTarget(raw) {
  const value = String(raw ?? '').trim();
  if (!value || value.toUpperCase() === 'ALL') {
    return { mode: 'all' };
  }
  const singlesId = parseAdminWipeSinglesId(value);
  if (!singlesId) return null;
  return { mode: 'singles', singlesId };
}
