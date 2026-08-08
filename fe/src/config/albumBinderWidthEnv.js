/**
 * fe/.env ALBUM_BINDER_WIDTH_PCT — spiral binder column as % of **one page** width
 * inside the open-book spread (edit / full screen). Requires vite envPrefix ALBUM_
 * (see vite.config.mjs). Restart Vite after changing.
 */

/** ~7–8% of one page keeps the spiral a thin strip between facing pages. */
const DEFAULT_ALBUM_BINDER_WIDTH_PCT = 7.5;

/** Album SlideShow binder = this fraction of the edit/original binder width. */
const SLIDESHOW_BINDER_OF_ORIGINAL = 2 / 3;

/** @returns {number} binder width percent (1–40), default 7.5 */
export function getAlbumBinderWidthPct() {
  const raw = String(import.meta.env.ALBUM_BINDER_WIDTH_PCT ?? '').trim();
  if (!raw) return DEFAULT_ALBUM_BINDER_WIDTH_PCT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ALBUM_BINDER_WIDTH_PCT;
  return Math.min(40, Math.max(1, parsed));
}

/** @returns {number} binder width as 0–1 ratio of one page width (edit / view) */
export function getAlbumBinderWidthRatio() {
  return getAlbumBinderWidthPct() / 100;
}

/** Album SlideShow: 2/3 of the original (edit) binder width. */
export function getAlbumSlideshowBinderWidthRatio() {
  return getAlbumBinderWidthRatio() * SLIDESHOW_BINDER_OF_ORIGINAL;
}
