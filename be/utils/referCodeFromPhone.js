import crypto from 'crypto';

/** 10-digit US phone for hashing (strip non-digits; drop leading country 1). */
export function normalizePhoneDigitsForRefer(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

/**
 * Deterministic 6-digit my_refer_code from phone (000000–999999). Collisions are allowed.
 * @param {string | null | undefined} phone — stored format (+1XXXXXXXXXX) or raw digits
 * @returns {string | null}
 */
export function referCodeFromPhone(phone) {
  const digits = normalizePhoneDigitsForRefer(phone);
  if (digits.length !== 10) return null;
  const hashHex = crypto.createHash('sha256').update(digits, 'utf8').digest('hex');
  const n = parseInt(hashHex.slice(0, 8), 16) % 1_000_000;
  return String(n).padStart(6, '0');
}
