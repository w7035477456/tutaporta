/**
 * Encrypt Password fail guard (Step 1 gate).
 * Cluster-safe via PostgreSQL: 2-minute cooldown after each wrong password;
 * 5 consecutive fails → format/wipe the pending storage side (OneDrive or USB).
 */

import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { wipeOneDriveVaultFolder, cleanupOneDriveStaging } from './recordVaultOneDrive/oneDriveVaultSync.js';
import {
  isLeftSideTutaDrive,
  loadMemberIdForSingles,
  wipeTutaDriveMemberVault
} from './tutaDriveMemberPaths.js';
import { clearRecordVaultCacheIcon } from './recordVaultCacheIcon.js';
import { formatCountdown } from './recordVaultUsb/unlockGuard.js';

export const VAULT_ACCESS_MAX_FAILED_ATTEMPTS = 5;
/** Default 2 minutes — env VAULT_ACCESS_RETRY_DELAY_SEC. */
const DEFAULT_RETRY_DELAY_SEC = 120;

function schema() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
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

export async function getVaultAccessFailStatus(singlesId, storageType = 'onedrive') {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return {
      locked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: getVaultAccessRetryDelaySeconds(),
      storageType: normalizeStorageType(storageType)
    };
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
    storageType: side
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

async function formatOneDriveFailSide(singlesId) {
  if (isLeftSideTutaDrive()) {
    const memberId = await loadMemberIdForSingles(singlesId);
    if (memberId) wipeTutaDriveMemberVault(memberId);
    await clearRecordVaultCacheIcon(singlesId, 'onedrive');
    return { vaultFormatted: true, storageType: 'onedrive', tutaDrive: true };
  }
  await wipeOneDriveVaultFolder(singlesId);
  cleanupOneDriveStaging(singlesId);
  await clearRecordVaultCacheIcon(singlesId, 'onedrive');
  return { vaultFormatted: true, storageType: 'onedrive' };
}

/**
 * Record a wrong vault-password attempt for the pending open side.
 * OneDrive: server formats on the 5th fail.
 * USB: client formats via bridge (`needsClientFormat`) — mount paths are local.
 */
export async function recordVaultAccessFail(singlesId, storageType = 'onedrive', { mountPath } = {}) {
  const id = Number(singlesId);
  const side = normalizeStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
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
      const sideLabel = side === 'usb' ? 'USB' : 'OneDrive';
      const attempt = Math.max(1, currentAttempts);
      return {
        locked: true,
        lockedUntil: currentLockedUntil,
        remainingSeconds: currentRemainingSeconds,
        failedAttempts: currentAttempts,
        maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
        lockoutSeconds: getVaultAccessRetryDelaySeconds(),
        storageType: side,
        error: `Incorrect Encrypt Password try ${attempt} of ${VAULT_ACCESS_MAX_FAILED_ATTEMPTS}. Retry cooldown ${formatCountdown(currentRemainingSeconds)}. Five consecutive fails will cause format to ${sideLabel}`,
        cooldownLabel: `Retry cooldown ${formatCountdown(currentRemainingSeconds)}`,
        vaultFormatted: false,
        needsClientFormat: false
      };
    }

    nextAttempts = currentAttempts + 1;
    const { rows: updatedRows } = await client.query(
      `UPDATE ${schema()}.notes_vault
          SET access_failed_attempts = $3,
              access_locked_until = NOW() + ($4::double precision * INTERVAL '1 second'),
              updated_at = NOW()
        WHERE singles_id = $1
          AND storage_backend = $2
      RETURNING access_locked_until`,
      [id, side, nextAttempts, getVaultAccessRetryDelaySeconds()]
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

  if (nextAttempts >= VAULT_ACCESS_MAX_FAILED_ATTEMPTS) {
    const sideLabel = side === 'usb' ? 'USB' : 'OneDrive';
    const pathValue = String(mountPath || '').trim() || null;

    if (side === 'usb') {
      await clearRecordVaultCacheIcon(id, 'usb');
      return {
        locked: false,
        remainingSeconds: 0,
        failedAttempts: nextAttempts,
        maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
        lockoutSeconds: getVaultAccessRetryDelaySeconds(),
        vaultFormatted: false,
        needsClientFormat: true,
        storageType: 'usb',
        mountPath: pathValue,
        error: `Incorrect Encrypt Password. Five failed attempts — ${sideLabel} vault has been formatted.`,
        cooldownLabel: ''
      };
    }

    let formatResult = { vaultFormatted: false };
    try {
      formatResult = await formatOneDriveFailSide(id);
      await clearVaultAccessFailStatus(id, side);
    } catch (err) {
      console.error('[recordVaultAccessFail] OneDrive format failed:', err?.message || err);
      return {
        locked: false,
        remainingSeconds: 0,
        failedAttempts: nextAttempts,
        maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
        lockoutSeconds: getVaultAccessRetryDelaySeconds(),
        vaultFormatted: false,
        needsClientFormat: false,
        storageType: 'onedrive',
        error: err?.message || 'Unable to format OneDrive vault after failed attempts',
        cooldownLabel: ''
      };
    }
    return {
      locked: false,
      remainingSeconds: 0,
      failedAttempts: nextAttempts,
      maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: getVaultAccessRetryDelaySeconds(),
      vaultFormatted: Boolean(formatResult.vaultFormatted),
      needsClientFormat: false,
      storageType: 'onedrive',
      error: `Incorrect Encrypt Password. Five failed attempts — ${sideLabel} vault has been formatted.`,
      cooldownLabel: ''
    };
  }

  const remainingSeconds = remainingLockSeconds(lockedUntil);
  const sideLabel = side === 'usb' ? 'USB' : 'OneDrive';
  return {
    locked: true,
    lockedUntil,
    remainingSeconds,
    failedAttempts: nextAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultAccessRetryDelaySeconds(),
    vaultFormatted: false,
    needsClientFormat: false,
    storageType: side,
    error: `Incorrect Encrypt Password try ${nextAttempts} of ${VAULT_ACCESS_MAX_FAILED_ATTEMPTS}. Retry cooldown ${formatCountdown(remainingSeconds)}. Five consecutive fails will cause format to ${sideLabel}`,
    cooldownLabel: `Retry cooldown ${formatCountdown(remainingSeconds)}`
  };
}
