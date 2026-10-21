import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { invalidateAuthUserCache } from './authUserLookupCache.js';

/** Completes "… will ___." in failAttemptWarning(). */
export const TUTAPHOTOS_LOCK_CONSEQUENCE = 'lock TutaPhotos, and you must contact tech support after that';

export const TUTAPHOTOS_LOCKED_MESSAGE =
  'TutaPhotos is locked after six failed Encrypt Password attempts in a row. Please contact tech support.';

function schema() {
  return String(getDBSchema() || 'outdateddbsnapshotoct2024').replace(/"/g, '');
}

export async function isTutaPhotosLocked(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const { rows } = await pool.query(
    `SELECT lock_tuta_photos
       FROM ${schema()}.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  return Boolean(rows[0]?.lock_tuta_photos);
}

export async function lockTutaPhotosForSingles(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  await pool.query(
    `UPDATE ${schema()}.singles
        SET lock_tuta_photos = true,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $1`,
    [id]
  );
  await invalidateAuthUserCache(id);
  return { lockTutaPhotos: true, singlesId: id };
}

export async function clearTutaPhotosLock(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  const { rows } = await pool.query(
    `UPDATE ${schema()}.singles
        SET lock_tuta_photos = false,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $1
      RETURNING singles_id, lock_tuta_photos`,
    [id]
  );
  if (!rows.length) {
    throw new Error('Singles row not found');
  }
  await invalidateAuthUserCache(id);
  return {
    singlesId: Number(rows[0].singles_id),
    lockTutaPhotos: Boolean(rows[0].lock_tuta_photos)
  };
}
