/** Signup emails ending with this suffix get member_category PilotUser. */
export const PILOT_USER_EMAIL_SUFFIX = '7035477456@gmail.com';

/**
 * Resolve member_category for a new self-service signup (e.g. Login →
 * "Don't have an account?" → /register). Default is AnyMember.
 * @param {unknown} emailNorm — lowercase email (see normalizeEmailForDb)
 * @returns {'AnyMember' | 'PilotUser'}
 */
export function resolveSignupMemberCategory(emailNorm) {
  const email = String(emailNorm ?? '').trim().toLowerCase();
  if (email.endsWith(PILOT_USER_EMAIL_SUFFIX)) {
    return 'PilotUser';
  }
  return 'AnyMember';
}
