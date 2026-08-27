import crypto from 'crypto';
import pool, { getDBSchema } from '../db/connection.js';
import { isDemoUserCategory } from './memberCategory.js';

const PUBLIC_MEMBER_ID_MIN = 100_000;
const PUBLIC_MEMBER_ID_MAX = 999_999;
const MAX_MEMBER_ID_ATTEMPTS = 50;

export async function allocateNextSinglesId(client = pool) {
  const singlesTableName = `${getDBSchema()}.singles`;
  const seqLookup = await client.query(`SELECT pg_get_serial_sequence($1, 'singles_id') AS seq_name`, [singlesTableName]);
  const seqName = seqLookup.rows[0]?.seq_name ? String(seqLookup.rows[0].seq_name) : '';
  if (seqName) {
    const nextFromSeq = await client.query(`SELECT nextval($1::regclass) AS singles_id`, [seqName]);
    const id = nextFromSeq.rows[0]?.singles_id;
    if (id != null) return id;
  }
  const nextFromMax = await client.query(`SELECT COALESCE(MAX(singles_id) + 1, 1) AS singles_id FROM helloworldjunktest.singles`);
  const id = nextFromMax.rows[0]?.singles_id;
  if (id == null) throw new Error('Unable to generate singles_id for new account.');
  return id;
}

/** DemoUser: (1000 + singles_id) concatenated with random 2 digits → 6-digit member_id. */
export function buildDemoUserMemberId(singlesId, twoDigitSuffix) {
  const sid = Number(singlesId);
  if (!Number.isFinite(sid) || sid < 1) {
    throw new Error('Invalid singles_id for DemoUser member_id.');
  }
  const base = 1000 + Math.trunc(sid);
  const suffix = String(twoDigitSuffix).padStart(2, '0').slice(-2);
  return Number(`${base}${suffix}`);
}

async function memberIdExists(client, memberId, { excludeSinglesId } = {}) {
  const params = [memberId];
  let sql = 'SELECT 1 FROM helloworldjunktest.singles WHERE member_id = $1';
  if (excludeSinglesId != null) {
    sql += ' AND singles_id <> $2';
    params.push(excludeSinglesId);
  }
  sql += ' LIMIT 1';
  const existing = await client.query(sql, params);
  return existing.rows.length > 0;
}

/** DemoUser member_id — unique among all singles rows. */
export async function allocateDemoUserMemberId(client, singlesId) {
  const base = 1000 + Math.trunc(Number(singlesId));
  for (let attempt = 0; attempt < MAX_MEMBER_ID_ATTEMPTS; attempt += 1) {
    const suffix = crypto.randomInt(0, 100);
    const candidate = Number(`${base}${String(suffix).padStart(2, '0')}`);
    const taken = await memberIdExists(client, candidate, { excludeSinglesId: singlesId });
    if (!taken) return candidate;
  }
  throw new Error(`Unable to allocate unique DemoUser member_id for singles_id ${singlesId}.`);
}

/** Public member_id — random 100000–999999, unique among all singles rows. */
export async function allocatePublicMemberId(client, { excludeSinglesId } = {}) {
  for (let attempt = 0; attempt < MAX_MEMBER_ID_ATTEMPTS; attempt += 1) {
    const candidate = crypto.randomInt(PUBLIC_MEMBER_ID_MIN, PUBLIC_MEMBER_ID_MAX + 1);
    const taken = await memberIdExists(client, candidate, { excludeSinglesId });
    if (!taken) return candidate;
  }
  throw new Error('Unable to allocate unique Public member_id.');
}

/** @deprecated alias — use allocatePublicMemberId */
export async function allocateRandomSixDigitMemberId(client) {
  return allocatePublicMemberId(client);
}

export async function allocateMemberIdForCategory(client, { memberCategory, singlesId }) {
  if (isDemoUserCategory(memberCategory)) {
    return allocateDemoUserMemberId(client, singlesId);
  }
  return allocatePublicMemberId(client, { excludeSinglesId: singlesId });
}
