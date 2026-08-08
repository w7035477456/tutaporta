import crypto from 'crypto';

/**
 * Deterministic 6-digit my_refer_code from member_id (000000–999999). Collisions are allowed.
 * @param {number | string | null | undefined} memberId
 * @returns {string | null}
 */
export function referCodeFromMemberId(memberId) {
  const n = Number(memberId);
  if (!Number.isFinite(n) || n < 0) return null;
  const hashHex = crypto.createHash('sha256').update(String(Math.trunc(n)), 'utf8').digest('hex');
  const code = parseInt(hashHex.slice(0, 8), 16) % 1_000_000;
  return String(code).padStart(6, '0');
}
