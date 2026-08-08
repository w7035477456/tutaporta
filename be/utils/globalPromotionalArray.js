import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';

const GLOBAL_ROW_ID = 1;
const CACHE_TTL_MS = 60_000;

/** @type {{ list: string[] | null, at: number }} */
let cache = { list: null, at: 0 };

function globalTableName() {
  const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return `"${schema}"."global"`;
}

/** @param {unknown} raw */
export function normalizePromotionalArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/**
 * Load helloworldjunktest.global.promotional_array (referral message templates).
 * Short in-process TTL; stale data is acceptable for invite copy.
 */
export async function loadGlobalPromotionalArray({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cache.list && now - cache.at < CACHE_TTL_MS) {
    return cache.list;
  }

  try {
    const { rows } = await pool.query(
      `SELECT promotional_array FROM ${globalTableName()} WHERE id = $1 LIMIT 1`,
      [GLOBAL_ROW_ID]
    );
    const list = normalizePromotionalArray(rows[0]?.promotional_array);
    cache = { list, at: now };
    return list;
  } catch (err) {
    console.error('[globalPromotionalArray] load failed:', err?.message ?? err);
    return cache.list ?? [];
  }
}

export function clearGlobalPromotionalArrayCache() {
  cache = { list: null, at: 0 };
}
