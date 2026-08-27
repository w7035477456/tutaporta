/**
 * ~/.ssh/be/.env SKIP_TUTAPHOTO_ENC
 * When true: skip Full Disk Encryption (Encrypt Password) gate for TutaPhotoAlbums only.
 * TutaNotes always requires Encrypt Password — do not mirror this flag there.
 */

function parseEnvBool(raw, defaultValue = false) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return defaultValue;
  if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

/** True → skip TutaPhotoAlbums Full Disk Encryption screen. */
export function isSkipTutaPhotoEncEnabled() {
  return parseEnvBool(process.env.SKIP_TUTAPHOTO_ENC, false);
}
