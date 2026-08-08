/** Demo / Guest Demo Login (credentials demo/demo or guest/guest) — UI allowlist + popup message. */

export const GUEST_DEMO_LOGIN_MESSAGE =
  'Sorry you are in Demo mode.\n' +
  'You can click around all menu and view, click on all orange tutorial button and read, but you can not interact with most button.\n' +
  'However registration for an account only require valid email and valid phone and mostly features are free, so we encourage you register and try out with real account.';

/** DOM marker for sidebar / footer / theme menu / orange help / TutaNotes login panels — clicks allowed in demo mode. */
export const GUEST_DEMO_ALLOW_ATTR = 'data-guest-demo-allow';

export function isGuestDemoLogin(user) {
  return Boolean(user?.guest_demo_login);
}

/** Login form alias ids (not real emails) — demo mode restrictions on the login page. */
export function isDemoGuestLoginAliasId(loginId) {
  const id = String(loginId ?? '')
    .trim()
    .toLowerCase();
  return id === 'demo' || id === 'guest';
}

/** True only for exact demo/demo or guest/guest (matches BE resolveDemoGuestLoginAlias). */
export function isDemoGuestLoginAliasCredentials(loginId, password) {
  const id = String(loginId ?? '')
    .trim()
    .toLowerCase();
  const pw = String(password ?? '')
    .trim()
    .toLowerCase();
  if (!id || !pw) return false;
  return (id === 'demo' && pw === 'demo') || (id === 'guest' && pw === 'guest');
}

export function guestDemoAllowProps() {
  return { [GUEST_DEMO_ALLOW_ATTR]: 'true' };
}
