import pool from '../db/connection.js';
import { isAnyMemberCategory, normalizeMemberCategoryEnum } from './memberCategory.js';

const DUPLICATE_PHONE_ERROR =
  'This phone number is already associated with an account. Please use a different number or sign in.';

/** Raw env: DUPLICATE_PHONE_ALLOW=true|false (only consulted for AnyMember). */
export function isDuplicatePhoneEnvEnabled() {
  return String(process.env.DUPLICATE_PHONE_ALLOW || '').trim().toLowerCase() === 'true';
}

/**
 * Whether duplicate phones are allowed for this member_category.
 * - Not AnyMember → always allowed
 * - AnyMember (or omitted/unknown → treat as AnyMember for public signup) → DUPLICATE_PHONE_ALLOW
 * @param {unknown} [memberCategory]
 */
export function isDuplicatePhoneAllowed(memberCategory) {
  const normalized = normalizeMemberCategoryEnum(memberCategory);
  if (normalized != null && !isAnyMemberCategory(normalized)) return true;
  return isDuplicatePhoneEnvEnabled();
}

/** @param {string} phoneRaw */
export function formatPhoneForDuplicateCheck(phoneRaw) {
  const phoneDigits = String(phoneRaw ?? '').replace(/\D/g, '');
  if (phoneDigits.length !== 10) return null;
  return `+1${phoneDigits}`;
}

/**
 * When duplicates are not allowed for this category, returns an error if phone is already on a singles row.
 * @param {string|null} formattedPhone
 * @param {unknown} [memberCategory]
 * @returns {Promise<string|null>}
 */
export async function findDuplicatePhoneRegistrationError(formattedPhone, memberCategory) {
  if (!formattedPhone || isDuplicatePhoneAllowed(memberCategory)) return null;
  const existing = await pool.query('SELECT singles_id FROM helloworldjunktest.singles WHERE phone = $1 LIMIT 1', [
    formattedPhone
  ]);
  if (existing.rows.length > 0) return DUPLICATE_PHONE_ERROR;
  return null;
}

/**
 * When duplicates are allowed for this category, singles.phone UNIQUE still applies —
 * pick a nearby unused E.164 value. Production AnyMember with DUPLICATE_PHONE_ALLOW=false keeps one account per phone.
 * @param {import('pg').PoolClient} client
 * @param {string} formattedPhone
 * @param {unknown} [memberCategory]
 * @returns {Promise<string>}
 */
export async function resolvePhoneForNewSinglesAccount(client, formattedPhone, memberCategory) {
  if (!formattedPhone) return formattedPhone;
  if (!isDuplicatePhoneAllowed(memberCategory)) return formattedPhone;

  const taken = await client.query('SELECT 1 FROM helloworldjunktest.singles WHERE phone = $1 LIMIT 1', [
    formattedPhone
  ]);
  if (!taken.rows.length) return formattedPhone;

  const digitStr = String(formattedPhone).replace(/\D/g, '');
  if (!/^\d{7,15}$/.test(digitStr)) return formattedPhone;

  let baseDigits = BigInt(digitStr);
  for (let offset = 1n; offset < 1000n; offset += 1n) {
    const candidate = `+${(baseDigits + offset).toString()}`;
    const clash = await client.query('SELECT 1 FROM helloworldjunktest.singles WHERE phone = $1 LIMIT 1', [
      candidate
    ]);
    if (!clash.rows.length) return candidate;
  }
  throw new Error('Could not allocate a unique phone for signup (DUPLICATE_PHONE_ALLOW)');
}

/**
 * @param {import('express').Response} res
 * @param {string|null} formattedPhone
 * @param {unknown} [memberCategory]
 * @returns {Promise<boolean>} true if response was sent (duplicate blocked)
 */
export async function respondIfDuplicatePhone(res, formattedPhone, memberCategory) {
  const message = await findDuplicatePhoneRegistrationError(formattedPhone, memberCategory);
  if (!message) return false;
  res.status(400).json({ error: message });
  return true;
}

export { DUPLICATE_PHONE_ERROR };
