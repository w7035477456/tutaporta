/**
 * Admin override: when false, never encrypt TutaNotes / TutaPhoto (at-rest files, E2E,
 * inner PIN, backup seal) and skip Encrypt Password UI. When true/unset, keep current flow.
 *
 * ~/.ssh/be/.env:
 *   TUTANOTES_ENCRYPT_ALLOWED=false|true
 *   TUTAPHOTO_ENCRYPT_ALLOWED=false|true
 */

function parseEnvBool(raw, defaultValue = true) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

/** Default true — unset keeps existing Encrypt Password / encryption behavior. */
export function isTutaNotesEncryptAllowed() {
  return parseEnvBool(process.env.TUTANOTES_ENCRYPT_ALLOWED, true);
}

/** Default true — unset keeps existing Encrypt Password / encryption behavior. */
export function isTutaPhotoEncryptAllowed() {
  return parseEnvBool(process.env.TUTAPHOTO_ENCRYPT_ALLOWED, true);
}
