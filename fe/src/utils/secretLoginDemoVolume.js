/** Demo-only: SPECIAL_LINK login shortcut forces background music to 10% for this browser session entry. */
export const SECRET_LOGIN_DEMO_VOLUME = 10;
const SECRET_LOGIN_DEMO_VOLUME_KEY = 'secretLogin5937DemoVolume';

export function markSecretLoginDemoVolume() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SECRET_LOGIN_DEMO_VOLUME_KEY, String(SECRET_LOGIN_DEMO_VOLUME));
}

export function consumeSecretLoginDemoVolume() {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(SECRET_LOGIN_DEMO_VOLUME_KEY);
  if (raw == null) return null;
  sessionStorage.removeItem(SECRET_LOGIN_DEMO_VOLUME_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return SECRET_LOGIN_DEMO_VOLUME;
  return Math.min(100, Math.max(0, Math.trunc(parsed)));
}
