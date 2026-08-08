/**
 * fe/.env — desktop (MUI `sm` and up, min-width 600px): numeric value becomes N vw.
 * DESKTOP_FONT_SIZE_TEXT — default body / subtitles / captions / most page copy
 * DESKTOP_FONT_SIZE_TITLE — headings (h1–h6), dialog titles, section titles where wired
 * DESKTOP_FONT_SIZE_BUTTON — label text inside buttons (MuiButton theme + typography.button)
 * DESKTOP_FONT_SIZE_MENU — sidebar: Close Menu, nav row labels, Exit to Mall (sm+; xs uses MOBILE_FONT_SIZE_MENU)
 * DESKTOP_FONT_SIZE_ICON — PNG icons inside Selected/UnSelected button templates (numeric → N vw)
 * DESKTOP_ICON_SIZE — icon width/height in vw (trash can, delete X buttons) where wired
 * Requires vite envPrefix DESKTOP_ (see vite.config.mjs).
 */

function readVwNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

/** @returns {string} e.g. "2vw" */
export function getDesktopTextFontSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_TEXT, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "1vw" — half of DESKTOP_FONT_SIZE_TEXT */
export function getDesktopTextFontSizeHalfVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_TEXT, 2);
  return `${n / 2}vw`;
}

/** @returns {string} e.g. "4vw" */
export function getDesktopTitleFontSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_TITLE, 4);
  return `${n}vw`;
}

/** @returns {string} e.g. "2vw" */
export function getDesktopButtonFontSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_BUTTON, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "1vw" — half of DESKTOP_FONT_SIZE_BUTTON */
export function getDesktopButtonFontSizeHalfVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_BUTTON, 2);
  return `${n / 2}vw`;
}

/** @returns {string} e.g. "2vw" */
export function getDesktopMenuFontSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_MENU, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "2vw" — Selected/UnSelected button template PNG icons (sm+). */
export function getDesktopIconFontSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_FONT_SIZE_ICON, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "2vw" */
export function getDesktopIconSizeVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_ICON_SIZE, 2);
  return `${n}vw`;
}

/** @returns {string} e.g. "1vw" — half of DESKTOP_ICON_SIZE */
export function getDesktopIconSizeHalfVw() {
  const n = readVwNumber(import.meta.env.DESKTOP_ICON_SIZE, 2);
  return `${n / 2}vw`;
}

/** fe/.env MY_PICKS_REMOVE_X_SCALE — fraction of half DESKTOP_ICON_SIZE (0.75 = 25% smaller). */
export function getMyPicksRemoveXScale() {
  const parsed = Number(String(import.meta.env.MY_PICKS_REMOVE_X_SCALE ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return 0.75;
  return parsed;
}
