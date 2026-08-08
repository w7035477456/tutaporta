import pool from '../db/connection.js';

const DUPLICATE_PHONE_ERROR =
  'This phone number is already associated with an account. Please use a different number or sign in.';

export function isDuplicatePhoneAllowed() {
  return String(process.env.DUPLICATE_PHONE_ALLOW || '').trim().toLowerCase() === 'true';
}

/** @param {string} phoneRaw */
export function formatPhoneForDuplicateCheck(phoneRaw) {
  const phoneDigits = String(phoneRaw ?? '').replace(/\D/g, '');
  if (phoneDigits.length !== 10) return null;
  return `+1${phoneDigits}`;
}

/**
 * When DUPLICATE_PHONE_ALLOW is not true, returns an error message if phone is already on a singles row.
 * @returns {Promise<string|null>}
 */
export async function findDuplicatePhoneRegistrationError(formattedPhone) {
  if (!formattedPhone || isDuplicatePhoneAllowed()) return null;
  const existing = await pool.query('SELECT singles_id FROM helloworldjunktest.singles WHERE phone = $1 LIMIT 1', [
    formattedPhone
  ]);
  if (existing.rows.length > 0) return DUPLICATE_PHONE_ERROR;
  return null;
}

/**
 * When DUPLICATE_PHONE_ALLOW=true, singles.phone UNIQUE still applies — pick a nearby unused E.164 value.
 * Mac/staging Twilio test-cell signups only; production keeps one account per phone.
 * @param {import('pg').PoolClient} client
 * @returns {Promise<string>}
 */
export async function resolvePhoneForNewSinglesAccount(client, formattedPhone) {
  if (!formattedPhone) return formattedPhone;
  if (!isDuplicatePhoneAllowed()) return formattedPhone;

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
 * @returns {Promise<boolean>} true if response was sent (duplicate blocked)
 */
export async function respondIfDuplicatePhone(res, formattedPhone) {
  const message = await findDuplicatePhoneRegistrationError(formattedPhone);
  if (!message) return false;
  res.status(400).json({ error: message });
  return true;
}

export { DUPLICATE_PHONE_ERROR };
