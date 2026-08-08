/**
 * fe/.env — requires vite envPrefix FOOTER_ (see vite.config.mjs).
 * FOOTER_HEIGHT = black auth footer height as % of viewport height (e.g. 2 → 2vh).
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

/** Auth footer fixed height in vh units (from FOOTER_HEIGHT). */
export function getAuthFooterHeightVh() {
  return readNumber('FOOTER_HEIGHT', 10, { min: 1, max: 45 });
}
