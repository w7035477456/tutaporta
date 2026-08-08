/**
 * Encrypt Password fail handling for TutaPhotoAlbums (Step 1 gate).
 *
 * Unlike TutaNotes: no retry cooldown and no auto-format after consecutive fails.
 * Wrong password → simple retry message only.
 */

import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';

export const VAULT_ACCESS_MAX_FAILED_ATTEMPTS = 5;
/** Kept for API compatibility; Photo Albums does not enforce a retry delay. */
const DEFAULT_RETRY_DELAY_SEC = 0;

const PHOTO_ALBUMS_WRONG_PASSWORD_ERROR = 'Incorrect Encrypt password, please try again';

function schema() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

export function getVaultAccessRetryDelaySeconds() {
  return DEFAULT_RETRY_DELAY_SEC;
}

function normalizeStorageType(storageType) {
  return storageType === 'usb' ? 'usb' : 'onedrive';
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
      lockoutSeconds: 0,
      storageType: side
    };
  }
  const { rows } = await pool.query(
    `SELECT access_failed_attempts
       FROM ${schema()}.photo_albums_vault
      WHERE singles_id = $1
        AND storage_backend = $2
      LIMIT 1`,
    [id, side]
  );
  const failedAttempts = Math.max(0, Math.floor(Number(rows[0]?.access_failed_attempts) || 0));
  return {
    locked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: 0,
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
 * TutaPhoto: no cooldown, no format — client may retry immediately.
 */
export async function photoAlbumsAccessFail(singlesId, storageType = 'onedrive') {
  const id = Number(singlesId);
  const side = normalizeStorageType(storageType);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }

  const client = await pool.connect();
  let nextAttempts = 1;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT access_failed_attempts
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
    nextAttempts = currentAttempts + 1;
    // Clear any legacy lock from older Photo Albums builds; never set a new one.
    await client.query(
      `UPDATE ${schema()}.photo_albums_vault
          SET access_failed_attempts = $3,
              access_locked_until = NULL,
              updated_at = NOW()
        WHERE singles_id = $1
          AND storage_backend = $2`,
      [id, side, nextAttempts]
    );
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

  return {
    locked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts: nextAttempts,
    maxFailedAttempts: VAULT_ACCESS_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: 0,
    vaultFormatted: false,
    needsClientFormat: false,
    storageType: side,
    error: PHOTO_ALBUMS_WRONG_PASSWORD_ERROR,
    cooldownLabel: ''
  };
}
