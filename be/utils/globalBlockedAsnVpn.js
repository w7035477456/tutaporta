import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { parseClientAsn } from './blockedAsnConfig.js';

const GLOBAL_ROW_ID = 1;
const CACHE_TTL_MS = 60_000;

/** @type {{ set: Set<number>, at: number, source: 'db' | 'fallback' }} */
let cache = { set: new Set(), at: 0, source: 'fallback' };

/** Bootstrap when DB is empty and GitHub fetch has not run yet. */
const FALLBACK_BLOCKED_ASN_NUMBERS = [
  9009,
  20448,
  209854,
  136787,
  32751,
  212238,
  50525,
  207137,
  60729,
  398391,
  401401,
  401720,
  200373,
  198571,
  208172
];

function globalTableName() {
  const schema = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return `"${schema}"."global"`;
}

/** @param {unknown} raw */
export function normalizeBlockedAsnArray(raw) {
  const out = new Set();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const n = typeof item === 'number' ? item : parseClientAsn(item);
    if (n != null && n > 0) out.add(n);
  }
  return out;
}

function applyCache(nextSet, source = 'db') {
  cache = { set: new Set(nextSet), at: Date.now(), source };
}

export function clearBlockedAsnVpnCache() {
  cache = { set: new Set(), at: 0, source: 'fallback' };
}

export function getBlockedAsnVpnCacheSource() {
  return cache.source;
}

export function getBlockedAsnVpnCount() {
  return cache.set.size;
}

/** @returns {Promise<number[]>} sorted ASN list from Postgres */
export async function readBlockedAsnVpnFromDb() {
  const { rows } = await pool.query(
    `SELECT blocked_asn_vpn FROM ${globalTableName()} WHERE id = $1 LIMIT 1`,
    [GLOBAL_ROW_ID]
  );
  return [...normalizeBlockedAsnArray(rows[0]?.blocked_asn_vpn)].sort((a, b) => a - b);
}

/**
 * Load global.blocked_asn_vpn into memory (admin sync / startup seed).
 * Short TTL so admin CRUD on any server is picked up within ~60s cluster-wide.
 */
export async function loadBlockedAsnVpnCache({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cache.set.size > 0 && now - cache.at < CACHE_TTL_MS) {
    return cache.set;
  }

  try {
    const list = await readBlockedAsnVpnFromDb();
    if (list.length > 0) {
      applyCache(list, 'db');
      return cache.set;
    }
  } catch (err) {
    console.error('[globalBlockedAsnVpn] load failed:', err?.message ?? err);
    if (cache.set.size > 0) return cache.set;
  }

  applyCache(FALLBACK_BLOCKED_ASN_NUMBERS, 'fallback');
  return cache.set;
}

/** Replace entire list (Primary write). */
export async function setBlockedAsnVpnList(asns) {
  const normalized = [...normalizeBlockedAsnArray(asns)].sort((a, b) => a - b);
  await pool.query(
    `UPDATE ${globalTableName()}
     SET blocked_asn_vpn = $1::integer[]
     WHERE id = $2`,
    [normalized, GLOBAL_ROW_ID]
  );
  applyCache(normalized, 'db');
  return normalized;
}

/** Append one ASN if not already present. */
export async function addBlockedAsnVpn(asnRaw) {
  const asn = parseClientAsn(asnRaw);
  if (asn == null) {
    throw new Error('Invalid ASN');
  }
  const current = await readBlockedAsnVpnFromDb();
  if (current.includes(asn)) return current;
  const next = [...current, asn].sort((a, b) => a - b);
  return setBlockedAsnVpnList(next);
}

/** Remove one ASN from the list. */
export async function removeBlockedAsnVpn(asnRaw) {
  const asn = parseClientAsn(asnRaw);
  if (asn == null) {
    throw new Error('Invalid ASN');
  }
  const current = await readBlockedAsnVpnFromDb();
  const next = current.filter((n) => n !== asn);
  return setBlockedAsnVpnList(next);
}

export async function initBlockedAsnVpnCache() {
  const set = await loadBlockedAsnVpnCache({ bypassCache: true });
  console.log(`[globalBlockedAsnVpn] loaded ${set.size} ASNs (${getBlockedAsnVpnCacheSource()})`);
  return set.size;
}
