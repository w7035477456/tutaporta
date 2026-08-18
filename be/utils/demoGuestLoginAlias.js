/**
 * Magic login aliases from the login form (not real singles emails).
 * - demo  → dm2@gmail.com with guest_demo_login (password optional / ignored)
 * - guest / guest → dm4@gmail.com with guest_demo_login (same UI restriction)
 * Concurrent sessions are allowed for these aliases (exception to single-login Redis).
 */

const DEMO_LOGIN_TARGET_EMAIL = 'dm2@gmail.com';
const GUEST_LOGIN_TARGET_EMAIL = 'dm4@gmail.com';

/**
 * @param {string} loginId
 * @param {string} password
 * @returns {{ email: string, guestDemoLogin: boolean } | null}
 */
export function resolveDemoGuestLoginAlias(loginId, password) {
  const id = String(loginId ?? '')
    .trim()
    .toLowerCase();
  const pw = String(password ?? '')
    .trim()
    .toLowerCase();
  if (!id) return null;

  if (id === 'demo') {
    return { email: DEMO_LOGIN_TARGET_EMAIL, guestDemoLogin: true };
  }
  if (id === 'guest' && pw === 'guest') {
    return { email: GUEST_LOGIN_TARGET_EMAIL, guestDemoLogin: true };
  }
  return null;
}
