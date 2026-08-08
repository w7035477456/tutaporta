import crypto from 'crypto';

/** Cryptographically random 6-digit string (100000–999999). */
export function generateSixDigitOtp() {
  return String(crypto.randomInt(100_000, 1_000_000));
}

/** Compare two digit strings without leaking length timing (normalized to same length). */
export function safeEqualOtp(providedDigits, storedDigits) {
  const a = String(providedDigits ?? '').trim();
  const b = String(storedDigits ?? '').trim();
  if (a.length !== b.length || a.length !== 6) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}
