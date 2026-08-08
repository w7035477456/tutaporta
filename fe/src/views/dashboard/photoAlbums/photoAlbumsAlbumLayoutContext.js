import { createContext, useContext } from 'react';

/**
 * Album page layout context for book-flip visibility and Path A photo blob loading.
 * Also hosts full-page photo viewer / slideshow opener.
 */
export const PhotoAlbumsAlbumLayoutContext = createContext({
  /** @deprecated Prefer activePageBands — single left band only (legacy). */
  activePageBand: null,
  /**
   * Visible book spread page bands (left + right of the open spread).
   * Photos/labels outside these are hidden (other spreads).
   */
  activePageBands: [],
  /**
   * Bands whose photo blobs may load (active page ±1). Client-only Path A lazy load —
   * each blob GET is still a stateless vault API call (safe under round-robin).
   */
  photoLoadBands: [],
  openPhotoFullscreen: null
});

export function usePhotoAlbumsAlbumLayout() {
  return useContext(PhotoAlbumsAlbumLayoutContext);
}

/** True if point sits inside any of the given page bands. */
export function pointInAnyAlbumBand(cx, cy, bands) {
  const list = Array.isArray(bands) ? bands : [];
  if (!list.length) return false;
  const x = Number(cx);
  const y = Number(cy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return list.some(
    (band) =>
      band &&
      band.height > 0 &&
      x >= band.left &&
      x <= band.left + band.width &&
      y >= band.top &&
      y <= band.top + band.height
  );
}
