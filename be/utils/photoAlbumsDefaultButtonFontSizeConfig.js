/** myPhotoAlbums menu button default label size (~/.ssh/be/.env PHOTOALBUMS_DEFAULT_BUTTON_FONT_SIZE_REM). */
const DEFAULT_VAULT_BUTTON_FONT_SIZE_REM = 2;

export function getVaultDefaultButtonFontSizeRem() {
  const raw = String(process.env.PHOTOALBUMS_DEFAULT_BUTTON_FONT_SIZE_REM ?? '').trim();
  if (!raw) return DEFAULT_VAULT_BUTTON_FONT_SIZE_REM;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VAULT_BUTTON_FONT_SIZE_REM;
  return Math.min(parsed, 8);
}

/** smallint tenths-of-rem → rem (null/invalid → env default). */
export function mynoteFontSizeTenthsToRem(tenths) {
  if (tenths == null) return getVaultDefaultButtonFontSizeRem();
  const n = Number(tenths);
  if (!Number.isFinite(n) || n <= 0) return getVaultDefaultButtonFontSizeRem();
  return n / 10;
}

export function parseMynoteFontSizeTenths(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const tenths = Math.trunc(n);
  if (tenths < 5 || tenths > 80) return null;
  return tenths;
}
