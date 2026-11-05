/**
 * myNote / TutaNotes button label size — the SAME source of truth as every other
 * button in the app: `DESKTOP_FONT_SIZE_BUTTON` (sm+) / `MOBILE_FONT_SIZE_BUTTON`
 * (xs) from fe/.env. That is exactly what the profile-menu (red-box) buttons use
 * via `buttonFontSizeResponsive` and the global MuiButton theme override.
 *
 * Those envs are vw-based, but the myNote font slider stores rem (tenths of rem in
 * Postgres). So the vw value is converted to rem for the CURRENT window width —
 * the same conversion TutaPhotoAlbums uses, so both vaults agree with the site.
 *
 * An optional absolute rem override remains available for one-off tuning:
 * `NOTES_DEFAULT_BUTTON_FONT_SIZE_REM` (from ~/.ssh/be/.env). When unset — the
 * normal case — the size follows DESKTOP_FONT_SIZE_BUTTON.
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

const FALLBACK_REM = 2;
const MIN_REM = 0.5;
const MAX_REM = 8;
/** MUI `sm` breakpoint — same split buttonFontSizeResponsive uses. */
const SM_MIN_WIDTH_PX = 600;

/** Root font size in px — rem→px conversion for the current document. */
function readRootFontPx() {
  if (typeof window === 'undefined') return 16;
  return Number.parseFloat(window.getComputedStyle?.(document.documentElement)?.fontSize) || 16;
}

/** Optional absolute rem override (rarely set — see NOTES_DEFAULT_BUTTON_FONT_SIZE_REM). */
function readRemOverride() {
  const raw = String(import.meta.env.NOTES_DEFAULT_BUTTON_FONT_SIZE_REM ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_REM);
}

/** "2vw" → 2, "2" → 2. Returns null when unparseable. */
function vwNumberFromCss(value) {
  const match = /^(-?[\d.]+)vw$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clampRem(rem) {
  if (!Number.isFinite(rem) || rem <= 0) return FALLBACK_REM;
  return Math.round(Math.min(MAX_REM, Math.max(MIN_REM, rem)) * 100) / 100;
}

/**
 * Button label size in rem for the current window width, following the same
 * `MOBILE_`/`DESKTOP_FONT_SIZE_BUTTON` envs as the rest of the app.
 *
 * Call again after a resize — a vw-derived size changes with the viewport.
 */
export function getVaultDefaultButtonFontSizeRem() {
  const override = readRemOverride();
  if (override != null) return override;

  if (typeof window === 'undefined' || !window.innerWidth) return FALLBACK_REM;

  const isSmUp = window.innerWidth >= SM_MIN_WIDTH_PX;
  const vw = vwNumberFromCss(
    isSmUp ? buttonFontSizeResponsive.sm : buttonFontSizeResponsive.xs
  );
  if (vw == null) return FALLBACK_REM;

  return clampRem((vw * window.innerWidth) / 100 / readRootFontPx());
}

/** Responsive button font sizes (vw) myNote mirrors — exported for tests/tooling. */
export function getVaultButtonFontEnvVw() {
  return { ...buttonFontSizeResponsive };
}
