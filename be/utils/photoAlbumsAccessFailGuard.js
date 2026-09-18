/**
 * Encrypt Password fail handling for TutaPhotoAlbums (Step 1 gate).
 *
 * 3-minute retry cooldown after each wrong password (persisted in photo_albums_vault).
 * No TutaNotes-style lock or auto-format.
 */

import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { formatCountdown } from './recordVaultUsb/unlockGuard.js';

export const VAULT_ACCESS_MAX_FAILED_ATTEMPTS = 5;
/** Default 3 minutes — env PHOTO_ALBUMS_ACCESS_RETRY_DELAY_SEC. */
const DEFAULT_RETRY_DELAY_SEC = 180;

const PHOTO_ALBUMS_WRONG_PASSWORD_ERROR = 'Incorrect Encrypt password, please try again';
const PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR = 'Incorrect current Encrypt password';

function schema() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

export function getVaultAccessRetryDelaySeconds() {
  const raw = process.env.PHOTO_ALBUMS_ACCESS_RETRY_DELAY_SEC;
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

function buildCooldownLabel(remainingSeconds) {
  return `Retry Cool Down ${formatCountdown(remainingSeconds)}`;
}

function buildFailResponse({
  storageType,
  failedAttempts,
  remainingSeconds,
  lockedUntil = null,
  wrongPasswordError = PHOTO_ALBUMS_WRONG_PASSWORD_ERROR
}) {
  const locked = remainingSeconds > 0;
  const cooldownLabel = locked ? buildCooldownLabel(remainingSeconds) : '';
  const error = locked
    ? `${wrongPasswordError} ${cooldownLabel}.`
    : wrongPasswordError;

  return {
    locked,
    lockedUntil: locked ? lockedUntil : null,
    remainingSeconds,
    failedAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: getVaultAccessRetryDelaySeconds(),
    storageType: normalizeStorageType(storageType),
    vaultFormatted: false,
    needsClientFormat: false,
    error,
    cooldownLabel
  };
}

export async function getVaultAccessFailStatus(singlesId, storageType = 'onedrive') {
  const id = Number(singlesId);
  const side = normalizeStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) {
    return {
      locked: false,
      remainingSeconds: 0,
      failedAttempts: 0,
      maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: getVaultAccessRetryDelaySeconds(),
      storageType: side
    };
  }

  const { rows } = await pool.query(
    `SELECT access_failed_attempts, access_locked_until
       FROM ${schema()}.photo_albums_vault
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
    `UPDATE ${schema()}.photo_albums_vault
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
 * Starts a 3-minute cooldown (photo_albums_vault.access_locked_until).
 */
export async function photoAlbumsAccessFail(
  singlesId,
  storageType = 'onedrive',
  { wrongPasswordError = PHOTO_ALBUMS_WRONG_PASSWORD_ERROR } = {}
) {
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
         FROM ${schema()}.photo_albums_vault
        WHERE singles_id = $1
          AND storage_backend = $2
        LIMIT 1
        FOR UPDATE`,
      [id, side]
    );
    if (!rows.length) {
      throw new Error(`Photo Albums vault key metadata is missing for ${side}`);
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
      return buildFailResponse({
        storageType: side,
        failedAttempts: currentAttempts,
        remainingSeconds: currentRemainingSeconds,
        lockedUntil: currentLockedUntil,
        wrongPasswordError
      });
    }

    nextAttempts = currentAttempts + 1;
    const lockoutSec = getVaultAccessRetryDelaySeconds();
    const { rows: updatedRows } = await client.query(
      `UPDATE ${schema()}.photo_albums_vault
          SET access_failed_attempts = $3,
              access_locked_until = NOW() + ($4::double precision * INTERVAL '1 second'),
              updated_at = NOW()
        WHERE singles_id = $1
          AND storage_backend = $2
      RETURNING access_locked_until`,
      [id, side, nextAttempts, lockoutSec]
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

  const remainingSeconds = remainingLockSeconds(lockedUntil);
  return buildFailResponse({
    storageType: side,
    failedAttempts: nextAttempts,
    remainingSeconds,
    lockedUntil,
    wrongPasswordError
  });
}

export { PHOTO_ALBUMS_WRONG_PASSWORD_ERROR, PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR };
