/**
 * Best-effort browser page-zoom % (Ctrl/Cmd +/-).
 *
 * Native Retina `devicePixelRatio` is often 2 at 100% zoom. Treating DPR as
 * zoom (or as a ratio against a stored baseline) false-triggers ~200% until
 * a window resize re-baselines — Cmd-0 then does nothing.
 *
 * Chrome/Safari/Firefox page zoom shrinks CSS `innerWidth` relative to
 * `outerWidth`. At 100% that ratio stays ~1 even on Retina. Window resize
 * changes both together, so the ratio stays ~1 and must not warn.
 */

export const BROWSER_ZOOM_TOLERANCE_PCT = 2;
const DEFAULT_ZOOM_TOLERANCE_PCT = BROWSER_ZOOM_TOLERANCE_PCT;

/** Snap to 100% when outer/inner is closer than Chrome's 90%/110% zoom steps. */
const LAYOUT_ZOOM_SNAP_PCT = 8;

/** Tab bar + bookmarks + download shelf — used to tell page zoom from a side dock. */
const BROWSER_CHROME_HEIGHT_MAX_PX = 320;

const STALE_BASELINE_STORAGE_KEY = 'vsingles.browserZoomBaseline.v3';

try {
  sessionStorage.removeItem(STALE_BASELINE_STORAGE_KEY);
} catch {
  // ignore
}

function roundZoomPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(25, Math.min(500, Math.round(n)));
}

function isLikelyMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isChromiumDesktop() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Chrome|Chromium|Edg\//.test(ua) && !/Mobile|Android/i.test(ua);
}

function heightAgreesWithWidthZoom(outerWidth, outerHeight, innerWidth, innerHeight, zoomW) {
  if (!(zoomW > 0) || innerHeight <= 0) return false;
  const expectedNoChrome = outerHeight / zoomW;
  const expectedMaxChrome = (outerHeight - BROWSER_CHROME_HEIGHT_MAX_PX) / zoomW;
  const lo = Math.min(expectedNoChrome, expectedMaxChrome) * 0.92;
  const hi = Math.max(expectedNoChrome, expectedMaxChrome) * 1.08;
  return innerHeight >= lo && innerHeight <= hi;
}

/**
 * Cmd/Ctrl +/- zoom: outerWidth stays with the window, innerWidth is CSS px.
 * Side docks (DevTools) only shrink width — height will not match the same zoom.
 */
function estimateLayoutPageZoomPercent(metrics) {
  const { innerWidth: iw, innerHeight: ih, outerWidth: ow, outerHeight: oh } = metrics;
  if (![iw, ih, ow, oh].every((n) => Number.isFinite(n) && n > 0)) return null;

  const zoomW = ow / iw;
  const widthPct = zoomW * 100;
  if (Math.abs(widthPct - 100) <= LAYOUT_ZOOM_SNAP_PCT) return 100;

  if (!heightAgreesWithWidthZoom(ow, oh, iw, ih, zoomW)) return 100;

  return roundZoomPercent(widthPct);
}

/** Pinch zoom on mobile (not desktop page zoom, not window resize). */
function readPinchZoomPercent() {
  if (!isLikelyMobile()) return null;
  const scale = window.visualViewport?.scale;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const pct = roundZoomPercent(scale * 100);
  if (pct == null || Math.abs(pct - 100) <= LAYOUT_ZOOM_SNAP_PCT) return null;
  return pct;
}

function readViewportMetrics() {
  if (typeof window === 'undefined') return null;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight
  };
}

/** @returns {number | null} e.g. 75, 100, 125 — null when unknown */
export function estimateBrowserZoomPercent() {
  const pinchPct = typeof window !== 'undefined' ? readPinchZoomPercent() : null;
  if (pinchPct != null) return pinchPct;

  const metrics = readViewportMetrics();
  if (!metrics) return null;

  return estimateLayoutPageZoomPercent(metrics);
}

export function isBrowserZoomLikelyDefault(tolerancePct = DEFAULT_ZOOM_TOLERANCE_PCT) {
  const pct = estimateBrowserZoomPercent();
  if (pct == null) return true;
  return Math.abs(pct - 100) <= tolerancePct;
}

export function isBrowserZoomBlocked(tolerancePct = DEFAULT_ZOOM_TOLERANCE_PCT) {
  const pct = estimateBrowserZoomPercent();
  if (pct == null) return false;
  return Math.abs(pct - 100) > tolerancePct;
}

export function getBrowserZoomResetShortcut() {
  if (typeof navigator === 'undefined') return 'Ctrl-0 or Cmd-0';
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || '') ? 'Cmd-0' : 'Ctrl-0';
}

export function isBrowserZoomDetectionSupported() {
  if (typeof window === 'undefined') return false;
  if (isChromiumDesktop()) return true;
  if (isLikelyMobile() && Number.isFinite(window.visualViewport?.scale)) return true;
  return (
    Number.isFinite(window.outerWidth) &&
    Number.isFinite(window.innerWidth) &&
    window.outerWidth > 0 &&
    window.innerWidth > 0
  );
}
