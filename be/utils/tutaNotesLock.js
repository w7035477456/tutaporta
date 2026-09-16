import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import { invalidateAuthUserCache } from './authUserLookupCache.js';

export const TUTANOTES_LOCK_WARNING_SUFFIX =
  'Five consecutive fails will lock TutaNotes, and you must contact tech support after that.';

export const TUTANOTES_LOCKED_MESSAGE =
  'TutaNotes is locked after five failed Encrypt Password attempts. Please contact tech support.';

function schema() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
}

export async function isTutaNotesLocked(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;
  const { rows } = await pool.query(
    `SELECT lock_tuta_notes
       FROM ${schema()}.singles
      WHERE singles_id = $1
      LIMIT 1`,
    [id]
  );
  return Boolean(rows[0]?.lock_tuta_notes);
}

export async function lockTutaNotesForSingles(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  await pool.query(
    `UPDATE ${schema()}.singles
        SET lock_tuta_notes = true,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $1`,
    [id]
  );
  await invalidateAuthUserCache(id);
  return { lockTutaNotes: true, singlesId: id };
}

export async function clearTutaNotesLock(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles id');
  }
  const { rows } = await pool.query(
    `UPDATE ${schema()}.singles
        SET lock_tuta_notes = false,
            updated_at = CURRENT_TIMESTAMP
      WHERE singles_id = $1
      RETURNING singles_id, lock_tuta_notes`,
    [id]
  );
  if (!rows.length) {
    throw new Error('Singles row not found');
  }
  await invalidateAuthUserCache(id);
  return {
    singlesId: Number(rows[0].singles_id),
    lockTutaNotes: Boolean(rows[0].lock_tuta_notes)
  };
}
