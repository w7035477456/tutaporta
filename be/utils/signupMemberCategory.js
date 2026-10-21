/**
 * Resolve member_category for a new self-service signup (e.g. Login →
 * "Don't have an account?" → /register, or Sign up with Google).
 * Always ANYMEMBER — never PILOTUSER from public signup. insertNewSinglesAccount upgrades it to
 * ANYMEMBER-S (Signup Refer Code) and processRaffleReferSignup to ANYMEMBER-R (Raffle Refer Code).
 * @param {unknown} [_emailNorm] — unused; kept for call-site compatibility
 * @returns {'ANYMEMBER'}
 */
export function resolveSignupMemberCategory(_emailNorm) {
  return 'ANYMEMBER';
}
