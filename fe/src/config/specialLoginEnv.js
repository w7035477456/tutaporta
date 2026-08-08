/** Dev/demo login shortcut from ~/.ssh/be/.env: SPECIAL_LINK, SPECIAL_ID, SPECIAL_P */

function normalizeSpecialLink(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  return s.startsWith('/') ? s : `/${s}`;
}

export function getSpecialLoginPath() {
  return normalizeSpecialLink(import.meta.env.SPECIAL_LINK);
}

export function getSpecialLoginPrefill() {
  return {
    email: String(import.meta.env.SPECIAL_ID ?? '').trim(),
    password: String(import.meta.env.SPECIAL_P ?? '').trim()
  };
}

export function isSpecialLoginConfigured() {
  return Boolean(getSpecialLoginPath() && getSpecialLoginPrefill().email);
}
