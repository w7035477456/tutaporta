/** Open sidebar width as a fraction of viewport — tracks window resize (see useNavDrawerOpenWidthPx). */
export const NAV_DRAWER_OPEN_WIDTH_RATIO = 0.28;

/**
 * Open drawer width (px): 30% of viewport, with optional floor.
 *
 * @param {number} viewportWidth — typically window.innerWidth
 * @param {{ minPx?: number }} [opts]
 */
export function measureNavDrawerOpenWidthPx(viewportWidth, opts = {}) {
  const { minPx = 220 } = opts;
  const vw = Number(viewportWidth) || 0;
  return Math.max(minPx, vw * NAV_DRAWER_OPEN_WIDTH_RATIO);
}
