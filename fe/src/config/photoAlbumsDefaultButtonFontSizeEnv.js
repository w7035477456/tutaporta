/**
 * TutaPhotoAlbums button label size (rem) — the same `MOBILE_`/`DESKTOP_FONT_SIZE_BUTTON`
 * envs as the rest of the app (fe/.env), converted to rem for the current window width
 * because the album font slider stores rem (tenths of rem in Postgres).
 *
 * An optional absolute rem override remains available:
 * `PHOTOALBUMS_DEFAULT_BUTTON_FONT_SIZE_REM` in ~/.ssh/be/.env.
 *
 * Call again after a resize — a vw-derived size changes with the viewport.
 */
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

const FALLBACK_REM = 2;
const MIN_REM = 0.5;
const MAX_REM = 8;
/** MUI `sm` breakpoint — same split buttonFontSizeResponsive uses. */
const SM_MIN_WIDTH_PX = 600;

function readRootFontPx() {
  if (typeof window === 'undefined') return 16;
  return Number.parseFloat(window.getComputedStyle?.(document.documentElement)?.fontSize) || 16;
}

function readRemOverride() {
  const raw = String(import.meta.env.PHOTOALBUMS_DEFAULT_BUTTON_FONT_SIZE_REM ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_REM);
}

function vwNumberFromCss(value) {
  const match = /^(-?[\d.]+)vw$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getVaultDefaultButtonFontSizeRem() {
  const override = readRemOverride();
  if (override != null) return override;

  if (typeof window === 'undefined' || !window.innerWidth) return FALLBACK_REM;

  const isSmUp = window.innerWidth >= SM_MIN_WIDTH_PX;
  const vw = vwNumberFromCss(
    isSmUp ? buttonFontSizeResponsive.sm : buttonFontSizeResponsive.xs
  );
  if (vw == null) return FALLBACK_REM;

  const rem = (vw * window.innerWidth) / 100 / readRootFontPx();
  if (!Number.isFinite(rem) || rem <= 0) return FALLBACK_REM;
  return Math.round(Math.min(MAX_REM, Math.max(MIN_REM, rem)) * 100) / 100;
}
