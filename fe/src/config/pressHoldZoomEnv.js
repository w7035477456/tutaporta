/**
 * fe/.env PRESS_HOLD_TO_ZOOM — when true, press-and-hold keeps the sidebar button zoom;
 * when false, a sustained press suppresses zoom (quick tap/click still zooms + navigates).
 * Requires vite envPrefix PRESS_ (see vite.config.mjs).
 */
export function readPressHoldToZoomEnabled() {
  return String(import.meta.env.PRESS_HOLD_TO_ZOOM ?? '').trim().toLowerCase() === 'true';
}
