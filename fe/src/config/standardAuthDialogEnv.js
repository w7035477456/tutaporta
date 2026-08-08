/**
 * fe/.env — requires vite envPrefix DIALOG_ (see vite.config.mjs).
 * DIALOG_WIDTH_MOBILE / DIALOG_WIDTH_DESKTOP (% of vw) for auth dialogs (not legal pages).
 */

function readNumber(key, fallback, { min, max } = {}) {
  const raw = String(import.meta.env[key] ?? '').trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  let v = parsed;
  if (typeof min === 'number') v = Math.max(min, v);
  if (typeof max === 'number') v = Math.min(max, v);
  return v;
}

/** Auth dialog width on viewports below MUI `md` (matches breakpoints.down('md')). */
export function getAuthDialogWidthVwMobile() {
  return readNumber('DIALOG_WIDTH_MOBILE', 90, { min: 20, max: 100 });
}

/** Auth dialog width on MUI `md` and up (~900px+). */
export function getAuthDialogWidthVwDesktop() {
  return readNumber('DIALOG_WIDTH_DESKTOP', 50, { min: 20, max: 100 });
}

/** Top margin as % of viewport height (e.g. 2 → 2vh). */
export function getAuthDialogMarginTopVh() {
  return readNumber('DIALOG_MARGIN_TOP', 2, { min: 0, max: 40 });
}

/** Bottom margin as % of viewport height (e.g. 4 → 4vh). */
export function getAuthDialogMarginBottomVh() {
  return readNumber('DIALOG_MARGIN_BOT', 2, { min: 0, max: 40 });
}

/** Side margin vw for mobile width. */
export function getAuthDialogSideMarginVwMobile() {
  const w = getAuthDialogWidthVwMobile();
  return Math.max(0, (100 - w) / 2);
}

/** Side margin vw for desktop width. */
export function getAuthDialogSideMarginVwDesktop() {
  const w = getAuthDialogWidthVwDesktop();
  return Math.max(0, (100 - w) / 2);
}
