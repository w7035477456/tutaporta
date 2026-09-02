/** Demo / Guest Demo Login (alias demo → dm2@gmail.com; guest/guest → dm4@gmail.com). */

export const GUEST_DEMO_LOGIN_MESSAGE =
  'Sorry you are in Demo mode.\n' +
  'You can click around all menu and view, click on all orange tutorial button and read, but you can not interact with most button.\n' +
  'However registration for an account only require valid email and valid phone and mostly features are free, so we encourage you register and try out with real account.';

/** Shown in the password field as soon as login id is "demo". */
export const DEMO_LOGIN_PASSWORD_HINT = '(not required for demo)';

/**
 * TutaNotes Full Disk Encryption password used for guest demo auto-unlock
 * (login alias `demo` / `guest` → skip Encrypt Password popup).
 */
export const DEMO_ENCRYPT_PASSWORD = 'q1221q1221';

/** DOM marker for sidebar / footer / theme menu / orange help / TutaNotes login panels — clicks allowed in demo mode. */
export const GUEST_DEMO_ALLOW_ATTR = 'data-guest-demo-allow';

/** DOM marker for mutating actions that stay blocked even on otherwise-unrestricted demo pages. */
export const GUEST_DEMO_BLOCK_ATTR = 'data-guest-demo-block';

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

export function isDemoLoginAliasId(loginId) {
  return (
    String(loginId ?? '')
      .trim()
      .toLowerCase() === 'demo'
  );
}

/** True for demo alias (any/blank password) or exact guest/guest (matches BE resolveDemoGuestLoginAlias). */
export function isDemoGuestLoginAliasCredentials(loginId, password) {
  const id = String(loginId ?? '')
    .trim()
    .toLowerCase();
  const pw = String(password ?? '')
    .trim()
    .toLowerCase();
  if (id === 'demo') return true;
  return id === 'guest' && pw === 'guest';
}

export function guestDemoAllowProps() {
  return { [GUEST_DEMO_ALLOW_ATTR]: 'true' };
}

export function guestDemoBlockProps() {
  return { [GUEST_DEMO_BLOCK_ATTR]: 'true' };
}
