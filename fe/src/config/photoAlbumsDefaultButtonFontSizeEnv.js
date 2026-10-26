/**
 * myPhotoAlbums button label size (rem) = fe/.env DESKTOP_FONT_SIZE_BUTTON (vw) at the current
 * window width, so TutaPhotos buttons match the rest of the site. Call again after a resize.
 */
const DEFAULT_DESKTOP_BUTTON_VW = 2;
const FALLBACK_REM = 2;
const MIN_REM = 0.5;
const MAX_REM = 8;

function readDesktopButtonVw() {
  const parsed = Number(String(import.meta.env.DESKTOP_FONT_SIZE_BUTTON ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DESKTOP_BUTTON_VW;
  return Math.min(parsed, 25);
}

export function getVaultDefaultButtonFontSizeRem() {
  if (typeof window === 'undefined' || !window.innerWidth) return FALLBACK_REM;
  const rootPx =
    Number.parseFloat(window.getComputedStyle?.(document.documentElement)?.fontSize) || 16;
  const rem = (readDesktopButtonVw() * window.innerWidth) / 100 / rootPx;
  if (!Number.isFinite(rem) || rem <= 0) return FALLBACK_REM;
  return Math.round(Math.min(MAX_REM, Math.max(MIN_REM, rem)) * 100) / 100;
}
