/**
 * Seed demo buddies when singles.seeded_demo_buddies_boolean is false and
 * singles.gender_self_report is set ('M' = male pack, 'F' = female pack).
 *
 * Gender is self-reported via FE popup (not DL / vet_bio).
 * If gender_self_report IS NULL → skip (FE shows "What Gender are you?").
 */
import { parseBooleanEnumRaw, sqlBooleanEnumLiteral } from './booleanEnum.js';
import { seedFemaleDemoFriendsForSinglesId } from './seedFemaleDemoFriends.js';
import { SCHEMA, seedMaleDemoFriendsForSinglesId } from './seedMaleDemoFriends.js';

const Q = `"${SCHEMA}"`;

/** @param {unknown} raw @returns {'M' | 'F' | null} */
export function normalizeGenderSelfReport(raw) {
  if (raw == null) return null;
  if (typeof raw === 'boolean') return raw ? 'M' : 'F';
  const s = String(raw).trim().toUpperCase();
  if (s === 'M' || s === 'MALE' || s === 'TRUE' || s === 'T' || s === '1') return 'M';
  if (s === 'F' || s === 'FEMALE' || s === 'FALSE' || s === '0') return 'F';
  return null;
}

/**
 * Mark seeded_demo_buddies_boolean = true after a successful seed.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 */
export async function markSeededDemoBuddiesTrue(db, singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) return;
  // Quote enum label — bare `true` is a boolean; boolean → boolean_enum cast fails.
  await db.query(
    `UPDATE ${Q}.singles
     SET seeded_demo_buddies_boolean = ${sqlBooleanEnumLiteral(true, SCHEMA)},
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1`,
    [id]
  );
}

/**
 * Persist self-reported gender. 'M' = male, 'F' = female.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @param {'M' | 'F' | boolean} genderOrIsMale
 */
export async function saveGenderSelfReport(db, singlesId, genderOrIsMale) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Invalid singles_id');
  }
  const gender = normalizeGenderSelfReport(genderOrIsMale);
  if (gender !== 'M' && gender !== 'F') {
    throw new Error("gender_self_report must be 'M' or 'F'");
  }
  await db.query(
    `UPDATE ${Q}.singles
     SET gender_self_report = $2::char(1),
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1`,
    [id, gender]
  );
  return gender;
}

/** @deprecated use saveGenderSelfReport */
export async function saveGenderSelfReportMale(db, singlesId, isMale) {
  return saveGenderSelfReport(db, singlesId, Boolean(isMale));
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @returns {Promise<{ skipped?: boolean, reason?: string, gender?: string, seeded?: boolean, pack?: string, result?: object, error?: string }>}
 */
export async function ensureSeededDemoBuddiesOnLogin(db, singlesId) {
  const id = Math.trunc(Number(singlesId));
  if (!Number.isFinite(id) || id < 1) {
    return { skipped: true, reason: 'invalid_singles_id' };
  }

  const { rows } = await db.query(
    `SELECT s.singles_id,
            s.email,
            s.seeded_demo_buddies_boolean,
            s.gender_self_report
     FROM ${Q}.singles s
     WHERE s.singles_id = $1
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) {
    return { skipped: true, reason: 'singles_not_found' };
  }

  if (parseBooleanEnumRaw(row.seeded_demo_buddies_boolean)) {
    return { skipped: true, reason: 'already_seeded' };
  }

  const gender = normalizeGenderSelfReport(row.gender_self_report);
  if (!gender) {
    return { skipped: true, reason: 'needs_gender_self_report' };
  }

  const isMale = gender === 'M';

  try {
    let result;
    let pack;
    if (isMale) {
      pack = 'male';
      result = await seedMaleDemoFriendsForSinglesId(db, id);
    } else {
      pack = 'female';
      result = await seedFemaleDemoFriendsForSinglesId(db, id);
    }
    await markSeededDemoBuddiesTrue(db, id);
    console.log(
      `[ensureSeededDemoBuddiesOnLogin] seeded ${pack} pack for singles_id=${id} email=${row.email}; flag=true`
    );
    return { skipped: false, seeded: true, gender, pack, result };
  } catch (err) {
    const message = String(err?.message ?? err);
    console.warn(
      `[ensureSeededDemoBuddiesOnLogin] seed failed singles_id=${id} email=${row.email} gender=${gender}: ${message}`
    );
    return { skipped: true, reason: 'seed_failed', gender, error: message };
  }
}

/**
 * Save self-report gender then seed demo buddies (popup Continue).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} singlesId
 * @param {'M' | 'F' | boolean} genderOrIsMale
 */
export async function saveGenderSelfReportAndSeedDemoBuddies(db, singlesId, genderOrIsMale) {
  const gender = await saveGenderSelfReport(db, singlesId, genderOrIsMale);
  const seed = await ensureSeededDemoBuddiesOnLogin(db, singlesId);
  return { gender, ...seed };
}
