/**
 * Encrypt Password fail guard (Step 1 gate).
 * Cluster-safe via PostgreSQL: 3 consecutive fails → retry cooldown;
 * 3 more fails after that (6 in a row) → lock TutaNotes (singles.lock_tuta_notes) until admin clears.
 */

import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { formatCountdown } from './recordVaultUsb/unlockGuard.js';
import {
  failAttemptLocks,
  failAttemptStartsCooldown,
  failAttemptWarning,
  FAIL_LOCK_AT_ATTEMPT
} from './failAttemptPolicy.js';
import {
  isTutaNotesLocked,
  lockTutaNotesForSingles,
  TUTANOTES_LOCK_CONSEQUENCE,
  TUTANOTES_LOCKED_MESSAGE
} from './tutaNotesLock.js';

export const VAULT_ACCESS_MAX_FAILED_ATTEMPTS = FAIL_LOCK_AT_ATTEMPT;
/** Default 2 minutes — env VAULT_ACCESS_RETRY_DELAY_SEC. */
const DEFAULT_RETRY_DELAY_SEC = 120;

function schema() {
  return String(getDBSchema() || 'outdateddbsnapshotoct2024').replace(/"/g, '');
}

export function getVaultAccessRetryDelaySeconds() {
  const raw = process.env.VAULT_ACCESS_RETRY_DELAY_SEC;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_RETRY_DELAY_SEC;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_DELAY_SEC;
  return Math.round(seconds);
}

function normalizeStorageType(storageType) {
  return storageType === 'usb' ? 'usb' : 'onedrive';
}

function remainingLockSeconds(lockedUntil, nowMs = Date.now()) {
  if (!lockedUntil) return 0;
  const untilMs = Date.parse(lockedUntil);
  if (!Number.isFinite(untilMs)) return 0;
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000));
}

function buildWrongPasswordError(failedAttempts, remainingSeconds) {
  const attempt = Math.max(1, failedAttempts);
  const cooldown = remainingSeconds > 0 ? ` Retry cooldown ${formatCountdown(remainingSeconds)}.` : '';
  return `Incorrect Encrypt Password try ${attempt} of ${VAULT_ACCESS_MAX_FAILED_ATTEMPTS}.${cooldown} ${failAttemptWarning(attempt, TUTANOTES_LOCK_CONSEQUENCE)}`;
}

function buildTutaNotesLockedStatus(storageType, failedAttempts = VAULT_ACCESS_MAX_FAILED_ATTEMPTS) {
  return {
    locked: false,
    remainingSeconds: 0,
    failedAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultAccessRetryDelaySeconds(),
    storageType: normalizeStorageType(storageType),
    tutaNotesLocked: true,
    vaultFormatted: false,
    needsClientFormat: false,
    error: TUTANOTES_LOCKED_MESSAGE,
    cooldownLabel: ''
  };
}

export async function getVaultAccessFailStatus(singlesId, storageType = 'onedrive') {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return {
      locked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: getVaultAccessRetryDelaySeconds(),
      storageType: normalizeStorageType(storageType),
      tutaNotesLocked: false
    };
  }
  if (await isTutaNotesLocked(id)) {
    return buildTutaNotesLockedStatus(storageType);
  }
  const side = normalizeStorageType(storageType);
  const { rows } = await pool.query(
    `SELECT access_failed_attempts, access_locked_until
       FROM ${schema()}.notes_vault
      WHERE singles_id = $1
        AND storage_backend = $2
      LIMIT 1`,
    [id, side]
  );
  const row = rows[0];
  const failedAttempts = Math.max(0, Math.floor(Number(row?.access_failed_attempts) || 0));
  const lockedUntil = row?.access_locked_until
    ? new Date(row.access_locked_until).toISOString()
    : null;
  const remainingSeconds = remainingLockSeconds(lockedUntil);
  return {
    locked: remainingSeconds > 0,
    lockedUntil: remainingSeconds > 0 ? lockedUntil : null,
    remainingSeconds,
    failedAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultAccessRetryDelaySeconds(),
    storageType: side,
    tutaNotesLocked: false,
    ...(failedAttempts > 0 ? { error: buildWrongPasswordError(failedAttempts, remainingSeconds) } : {})
  };
}

export async function clearVaultAccessFailStatus(singlesId, storageType = 'onedrive') {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return;
  await pool.query(
    `UPDATE ${schema()}.notes_vault
        SET access_failed_attempts = 0,
            access_locked_until = NULL,
            updated_at = NOW()
      WHERE singles_id = $1
        AND storage_backend = $2`,
    [id, normalizeStorageType(storageType)]
  );
}

/**
 * Record a wrong vault-password attempt for the pending open side.
 * 3rd consecutive fail → retry cooldown; 6th → singles.lock_tuta_notes (admin must clear).
 */
export async function recordVaultAccessFail(singlesId, storageType = 'onedrive', { mountPath } = {}) {
  const id = Number(singlesId);
  const side = normalizeStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }

  if (await isTutaNotesLocked(id)) {
    return buildTutaNotesLockedStatus(side);
  }

  const client = await pool.connect();
  let nextAttempts;
  let lockedUntil;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT access_failed_attempts, access_locked_until
         FROM ${schema()}.notes_vault
        WHERE singles_id = $1
          AND storage_backend = $2
        LIMIT 1
        FOR UPDATE`,
      [id, side]
    );
    if (!rows.length) {
      throw new Error(`Record Vault key metadata is missing for ${side}`);
    }

    const currentAttempts = Math.max(
      0,
      Math.floor(Number(rows[0].access_failed_attempts) || 0)
    );
    const currentLockedUntil = rows[0].access_locked_until
      ? new Date(rows[0].access_locked_until).toISOString()
      : null;
    const currentRemainingSeconds = remainingLockSeconds(currentLockedUntil);
    if (currentRemainingSeconds > 0) {
      await client.query('COMMIT');
      return {
        locked: true,
        lockedUntil: currentLockedUntil,
        remainingSeconds: currentRemainingSeconds,
        failedAttempts: currentAttempts,
        maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
        lockoutSeconds: getVaultAccessRetryDelaySeconds(),
        storageType: side,
        error: buildWrongPasswordError(currentAttempts, currentRemainingSeconds),
        cooldownLabel: `Retry cooldown ${formatCountdown(currentRemainingSeconds)}`,
        vaultFormatted: false,
        needsClientFormat: false,
        tutaNotesLocked: false
      };
    }

    nextAttempts = currentAttempts + 1;
    const cooldownSec = failAttemptStartsCooldown(nextAttempts) ? getVaultAccessRetryDelaySeconds() : 0;
    const { rows: updatedRows } = await client.query(
      `UPDATE ${schema()}.notes_vault
          SET access_failed_attempts = $3,
              access_locked_until = CASE WHEN $4::double precision > 0
                THEN NOW() + ($4::double precision * INTERVAL '1 second')
                ELSE NULL END,
              updated_at = NOW()
        WHERE singles_id = $1
          AND storage_backend = $2
      RETURNING access_locked_until`,
      [id, side, nextAttempts, cooldownSec]
    );
    lockedUntil = updatedRows[0]?.access_locked_until
      ? new Date(updatedRows[0].access_locked_until).toISOString()
      : null;
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failure; preserve the original error.
    }
    throw err;
  } finally {
    client.release();
  }

  if (failAttemptLocks(nextAttempts)) {
    try {
      await lockTutaNotesForSingles(id);
      await clearVaultAccessFailStatus(id, 'onedrive');
      await clearVaultAccessFailStatus(id, 'usb');
    } catch (err) {
      console.error('[recordVaultAccessFail] TutaNotes lock failed:', err?.message || err);
      return {
        locked: false,
        remainingSeconds: 0,
        failedAttempts: nextAttempts,
        maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
        lockoutSeconds: getVaultAccessRetryDelaySeconds(),
        vaultFormatted: false,
        needsClientFormat: false,
        tutaNotesLocked: false,
        storageType: side,
        mountPath: String(mountPath || '').trim() || null,
        error: err?.message || 'Unable to lock TutaNotes after failed attempts',
        cooldownLabel: ''
      };
    }
    return buildTutaNotesLockedStatus(side, nextAttempts);
  }

  const remainingSeconds = remainingLockSeconds(lockedUntil);
  return {
    locked: remainingSeconds > 0,
    lockedUntil: remainingSeconds > 0 ? lockedUntil : null,
    remainingSeconds,
    failedAttempts: nextAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultAccessRetryDelaySeconds(),
    vaultFormatted: false,
    needsClientFormat: false,
    tutaNotesLocked: false,
    storageType: side,
    error: buildWrongPasswordError(nextAttempts, remainingSeconds),
    cooldownLabel: remainingSeconds > 0 ? `Retry cooldown ${formatCountdown(remainingSeconds)}` : ''
  };
}
