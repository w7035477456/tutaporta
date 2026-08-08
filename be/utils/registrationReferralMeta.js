import { normalizeReferralCodeQuery } from '../routes/singles/validateReferralCode.js';

export function parseRegistrationMeta(passwordHash) {
  if (!passwordHash) return {};
  try {
    const parsed = JSON.parse(String(passwordHash));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Six-digit referrer code saved at /api/register (registration_email.password_hash JSON). */
export function referCodeFromRegistrationMeta(passwordHash) {
  const meta = parseRegistrationMeta(passwordHash);
  return normalizeReferralCodeQuery(meta.ref);
}

/** Active registration_email row for this address (unused, unexpired). */
export async function referCodeFromActiveRegistrationEmail(pool, emailNorm) {
  const { rows } = await pool.query(
    `SELECT password_hash
     FROM helloworldjunktest.verifications
     WHERE email = $1
       AND kind = 'registration_email'
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY id DESC
     LIMIT 1`,
    [emailNorm]
  );
  return referCodeFromRegistrationMeta(rows[0]?.password_hash);
}
