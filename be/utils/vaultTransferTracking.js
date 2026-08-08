import pool from '../db/connection.js';
import {
  clusterRedisGetInt,
  clusterRedisIncrBy,
  clusterRedisTakeInt
} from './clusterRedisState.js';

/**
 * When purchased/initial Tx/Rx data is exhausted, stretch each transfer to this
 * wall-time multiple (`NOTES_OVERLIMIT_THROTTLE_MULTIPLE` in ~/.ssh/be/.env).
 * Example: 5 → a 1s transfer becomes ~5s. Default 10.
 */
export const VAULT_TRANSFER_OVERAGE_THROTTLE_FACTOR = (() => {
  const n = Number(process.env.NOTES_OVERLIMIT_THROTTLE_MULTIPLE);
  if (Number.isFinite(n) && n >= 1) return n;
  return 10;
})();

/** Cap a single throttle sleep so a huge file cannot park a worker for hours. */
const MAX_OVERAGE_SLEEP_MS = 10 * 60 * 1000;

/** Purchase block shown in TutaNotes usage bar ("add 10GB block"). */
export const VAULT_REFILL_BLOCK_MB = (() => {
  const gb = Number(process.env.GB_PER_TOKEN);
  return (Number.isFinite(gb) && gb > 0 ? Math.max(1, Math.round(gb)) : 10) * 1024;
})();

/** UI copy when NOTES_OVERLIMIT_THROTTLE_MULTIPLE is stretching transfers (line 2 under upload status). */
export function getVaultTransferThrottleRefillLabel() {
  return 'Data Transfer Refill Depleted. Transfer Speed is being throttled. Please REFILL to return to maximum speed.';
}

/** One-time courtesy Tx/Rx balance for new members (default one 10GB block). */
export function getVaultInitialDataMb() {
  const n = Number(process.env.VAULT_INITIAL_DATA_MB);
  if (Number.isFinite(n) && n >= 0) return Math.round(n);
  return VAULT_REFILL_BLOCK_MB;
}

const PENDING_BYTES_PREFIX = 'v1:record_vault:transfer_pending_bytes:';

function pendingBytesKey(singlesId) {
  return `${PENDING_BYTES_PREFIX}${Math.trunc(Number(singlesId))}`;
}

function sleepMs(ms) {
  const n = Math.max(0, Math.floor(Number(ms) || 0));
  if (n <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, n));
}

function pendingBytesToMb(pendingBytes) {
  const b = Math.max(0, Math.floor(Number(pendingBytes) || 0));
  if (b <= 0) return 0;
  return Math.max(1, Math.ceil(b / (1024 * 1024)));
}

export async function addVaultTransferBytes(singlesId, bytes) {
  const id = Number(singlesId);
  const b = Number(bytes);
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(b) || b <= 0) return 0;
  try {
    const { rows } = await pool.query(
      'SELECT helloworldjunktest.add_notes_transfer_mb($1, $2) AS refill_remain_mb',
      [id, Math.floor(b)]
    );
    return Number(rows[0]?.refill_remain_mb) || 0;
  } catch (err) {
    console.error('[vault-transfer] add failed:', err?.message || err);
    return 0;
  }
}

/** Credit purchased / admin refill blocks onto singles.refill_remain_mb. */
export async function addVaultRefillMb(singlesId, addMb) {
  const id = Number(singlesId);
  const n = Math.round(Number(addMb) || 0);
  if (!Number.isFinite(id) || id < 1 || n <= 0) return 0;
  try {
    const { rows } = await pool.query(
      'SELECT helloworldjunktest.add_vault_refill_mb($1, $2) AS refill_remain_mb',
      [id, n]
    );
    return Number(rows[0]?.refill_remain_mb) || 0;
  } catch (err) {
    console.error('[vault-transfer] refill add failed:', err?.message || err);
    return 0;
  }
}

/**
 * True when refill_remain_mb (minus Redis pending) is exhausted.
 * Operations still proceed; callers throttle wall time by NOTES_OVERLIMIT_THROTTLE_MULTIPLE.
 */
export async function isVaultTransferQuotaExhausted(singlesId) {
  const stats = await getVaultTransferStats(singlesId);
  return (Number(stats.refillRemainMb) || 0) <= 0;
}

/**
 * After a transfer that began at `startedAtMs`, sleep so wall time ≈
 * NOTES_OVERLIMIT_THROTTLE_MULTIPLE × elapsed when quota is exhausted.
 * Optional onProgress({ remainingMs, totalThrottleMs, label }) for UI while sleeping.
 */
export async function throttleVaultTransferIfExhausted(singlesId, startedAtMs, { onProgress } = {}) {
  const started = Number(startedAtMs);
  if (!Number.isFinite(started) || started <= 0) return;
  if (!(await isVaultTransferQuotaExhausted(singlesId))) return;
  const elapsed = Math.max(0, Date.now() - started);
  const extraMs = Math.min(
    MAX_OVERAGE_SLEEP_MS,
    Math.floor(elapsed * (VAULT_TRANSFER_OVERAGE_THROTTLE_FACTOR - 1))
  );
  if (extraMs <= 0) return;
  const endAt = Date.now() + extraMs;
  const report = typeof onProgress === 'function' ? onProgress : null;
  const throttleLabel = getVaultTransferThrottleRefillLabel();
  while (Date.now() < endAt) {
    const remainingMs = Math.max(0, endAt - Date.now());
    if (report) {
      try {
        await report({
          remainingMs,
          totalThrottleMs: extraMs,
          label: throttleLabel,
          throttled: true
        });
      } catch {
        // Progress UI must never fail vault open.
      }
    }
    await sleepMs(Math.min(1000, remainingMs));
  }
}

/**
 * Accumulate upload/download bytes in Redis; flush to Postgres on logoff.
 * Pass `startedAtMs` to apply over-quota throttle — only after the user is
 * inside an unlocked OneDrive/USB workspace (lazy media, save, logoff sync).
 * Omit `startedAtMs` for Open / gate restore so entry is never slowed.
 */
export async function trackVaultTransferBytes(singlesId, bytes, startedAtMs = null, opts = {}) {
  const id = Math.trunc(Number(singlesId));
  const b = Math.floor(Number(bytes));
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(b) || b <= 0) return;
  await clusterRedisIncrBy(pendingBytesKey(id), b);
  if (startedAtMs != null) {
    await throttleVaultTransferIfExhausted(id, startedAtMs, opts);
  }
}

export async function flushVaultTransferBytes(singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return 0;
  const pending = await clusterRedisTakeInt(pendingBytesKey(id));
  if (pending <= 0) return 0;
  return addVaultTransferBytes(id, pending);
}

export async function getVaultTransferStats(singlesId) {
  const initialDataMb = getVaultInitialDataMb();
  const id = Math.trunc(Number(singlesId));
  try {
    const { rows } = await pool.query(
      `SELECT notes_total_transfer_mb, refill_remain_mb, refill_bought_mb
         FROM helloworldjunktest.singles
        WHERE singles_id = $1
        LIMIT 1`,
      [singlesId]
    );
    const usedMb = Number(rows[0]?.notes_total_transfer_mb) || 0;
    let refillRemainMb = Number(rows[0]?.refill_remain_mb);
    if (!Number.isFinite(refillRemainMb)) refillRemainMb = initialDataMb;
    let refillBoughtMb = Number(rows[0]?.refill_bought_mb);
    if (!Number.isFinite(refillBoughtMb) || refillBoughtMb < 0) refillBoughtMb = initialDataMb;
    if (Number.isFinite(id) && id >= 1) {
      const pendingMb = pendingBytesToMb(await clusterRedisGetInt(pendingBytesKey(id)));
      refillRemainMb -= pendingMb;
    }
    const leftMb = refillRemainMb;
    const leftPct =
      initialDataMb > 0
        ? Math.round((Math.max(0, leftMb) / initialDataMb) * 1000) / 10
        : leftMb > 0
          ? 100
          : 0;
    return {
      usedMb,
      limitMb: initialDataMb,
      leftMb,
      leftPct,
      refillRemainMb,
      refillBoughtMb,
      refillBlockMb: VAULT_REFILL_BLOCK_MB,
      overageThrottled: refillRemainMb <= 0
    };
  } catch (err) {
    console.warn('[vault-transfer] stats unavailable:', err?.message || err);
    return {
      usedMb: 0,
      limitMb: initialDataMb,
      leftMb: initialDataMb,
      leftPct: 100,
      refillRemainMb: initialDataMb,
      refillBoughtMb: initialDataMb,
      refillBlockMb: VAULT_REFILL_BLOCK_MB,
      overageThrottled: false
    };
  }
}
