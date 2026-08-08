/** SHA-256 hex of lowercase FA5 object icon name — must match be/utils/secretIconHash.js */
export async function hashSecretIconName(iconName) {
  const normalized = String(iconName ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  if (!normalized || typeof crypto === 'undefined' || !crypto.subtle) {
    return '';
  }
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
