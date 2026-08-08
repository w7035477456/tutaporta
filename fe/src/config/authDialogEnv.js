/**
 * Auth dialog env (fe/.env). Requires vite envPrefix VERTICAL_ and HORIZONTAL_ (see vite.config.mjs).
 */

export function readAppDialogScale() {
  if (typeof document === 'undefined') return 1;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--app-dialog-scale').trim();
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function envIsTrue(key) {
  const v = import.meta.env[key];
  return String(v ?? '').trim().toLowerCase() === 'true';
}

/** Mobile: show vertical scrollbar only when true. */
export function getMobileScrollbarVertical() {
  return envIsTrue('VERTICAL_SCROLLBAR');
}

/** Mobile: show horizontal scrollbar only when true. */
export function getMobileScrollbarHorizontal() {
  return envIsTrue('HORIZONTAL_SCROLLBAR');
}

/**
 * @param {boolean} isMobile — from useMediaQuery(theme.breakpoints.down('md'))
 */
export function getMobileScrollbarOverflowSx(isMobile) {
  if (!isMobile) return {};
  return {
    overflowY: getMobileScrollbarVertical() ? 'auto' : 'hidden',
    overflowX: getMobileScrollbarHorizontal() ? 'auto' : 'hidden'
  };
}
