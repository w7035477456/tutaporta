import pool from '../../db/connection.js';
import { formatMemberDisplayCode } from '../../utils/memberDisplayCode.js';
import { DEFAULT_REFER_BY_CODE, isDefaultReferByCode, normalizeReferByCodeDigits } from '../../utils/referByCode.js';

/** Six-digit ref from query/body; empty when missing, invalid, or reserved no-referrer sentinel. */
export function normalizeReferralCodeQuery(raw) {
  const digits = normalizeReferByCodeDigits(raw);
  if (!digits || isDefaultReferByCode(digits)) return '';
  return digits;
}

/** GET /api/public/validateReferralCode?ref=… — checks singles.my_refer_code (no auth). */
export async function validateReferralCode(req, res) {
  try {
    const code = normalizeReferralCodeQuery(req.query?.ref ?? req.query?.referByCode ?? req.query?.token);
    if (!code) {
      const rawDigits = normalizeReferByCodeDigits(
        req.query?.ref ?? req.query?.referByCode ?? req.query?.token
      );
      if (rawDigits === DEFAULT_REFER_BY_CODE) {
        return res.status(200).json({
          present: true,
          valid: false,
          code: DEFAULT_REFER_BY_CODE,
          noReferrer: true
        });
      }
      return res.status(200).json({ present: false, valid: false });
    }

    const { rows } = await pool.query(
      `SELECT alias, member_id
       FROM helloworldjunktest.singles
       WHERE my_refer_code = $1
       LIMIT 1`,
      [code]
    );

    const row = rows[0];
    const referrerAlias = row ? String(row.alias ?? '').trim() : '';
    const referrerMemberCode = row ? formatMemberDisplayCode(row.member_id) : null;

    return res.status(200).json({
      present: true,
      valid: rows.length > 0,
      code,
      referrerAlias: referrerAlias || null,
      referrerMemberCode
    });
  } catch (err) {
    console.error('[validateReferralCode]', err?.message || err);
    return res.status(500).json({ error: 'Failed to validate referral code.' });
  }
}
