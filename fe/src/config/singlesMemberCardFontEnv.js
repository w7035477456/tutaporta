/**
 * fe/.env — All Singles / Interested (mobile uses MOBILE_* as N vw; sm+ keeps rem in components).
 * MOBILE_FONT_SIZE_TEXT — filter summary + instructions link
 * MOBILE_FONT_SIZE_TITLE — page title + member id (mobile photo overlay)
 * MOBILE_FONT_SIZE_BUTTON — button label text on xs (member cards + global button theme xs)
 * MOBILE_FONT_SIZE_MENU — sidebar menu labels + Close Menu / Exit to Mall on xs
 * Desktop (sm+): see config/desktopFontEnv.js (DESKTOP_FONT_SIZE_*).
 * Requires vite envPrefix MOBILE_ / DESKTOP_ (see vite.config.mjs).
 */

function readVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** @returns {string} e.g. "2vw" */
export function getMobileSinglesTextFontSizeVw() {
  const n = readVwNumber(import.meta.env.MOBILE_FONT_SIZE_TEXT, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "1vw" — half of MOBILE_FONT_SIZE_TEXT */
export function getMobileSinglesTextFontSizeHalfVw() {
  const n = readVwNumber(import.meta.env.MOBILE_FONT_SIZE_TEXT, 2);
  return `${n / 2}vw`;
}

/** @returns {string} e.g. "3vw" */
export function getMobileSinglesTitleFontSizeVw() {
  const n = readVwNumber(import.meta.env.MOBILE_FONT_SIZE_TITLE, 3);
  return `${n}vw`;
}

/** @returns {string} e.g. "2vw" */
export function getMobileSinglesButtonFontSizeVw() {
  const n = readVwNumber(import.meta.env.MOBILE_FONT_SIZE_BUTTON, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "2vw" */
export function getMobileMenuFontSizeVw() {
  const n = readVwNumber(import.meta.env.MOBILE_FONT_SIZE_MENU, 2);
  return `${n}vw`;
}
