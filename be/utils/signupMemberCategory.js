/**
 * Resolve member_category for a new self-service signup (e.g. Login →
 * "Don't have an account?" → /register, or Sign up with Google).
 * Always AnyMember — never PilotUser from public signup.
 * @param {unknown} [_emailNorm] — unused; kept for call-site compatibility
 * @returns {'AnyMember'}
 */
export function resolveSignupMemberCategory(_emailNorm) {
  return 'AnyMember';
}
