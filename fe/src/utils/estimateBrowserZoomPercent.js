/**
 * Best-effort browser page-zoom % (Ctrl/Cmd +/-).
 *
 * Window resize is NOT page zoom. Resizing often changes `innerWidth` alone
 * (scrollbar gutter, chrome) while `outerWidth` stays fixed — that must not
 * trigger a zoom warning.
 *
 * We only treat `devicePixelRatio` changes as page zoom. Viewport width/height
 * changes re-baseline and stay at 100%.
 */

const BASELINE_STORAGE_KEY = 'vsingles.browserZoomBaseline.v3';
export const BROWSER_ZOOM_TOLERANCE_PCT = 2;
const DEFAULT_ZOOM_TOLERANCE_PCT = BROWSER_ZOOM_TOLERANCE_PCT;

function roundZoomPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(25, Math.min(500, Math.round(n)));
}

function readStoredBaseline() {
  try {
    const raw = sessionStorage.getItem(BASELINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.dpr === 'number' && parsed.dpr > 0) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStoredBaseline(dpr, outerWidth, innerWidth, outerHeight, innerHeight, lastZoomPct = 100) {
  try {
    sessionStorage.setItem(
      BASELINE_STORAGE_KEY,
      JSON.stringify({
        dpr,
        outerWidth: Number.isFinite(outerWidth) ? outerWidth : null,
        innerWidth: Number.isFinite(innerWidth) ? innerWidth : null,
        outerHeight: Number.isFinite(outerHeight) ? outerHeight : null,
        innerHeight: Number.isFinite(innerHeight) ? innerHeight : null,
        lastZoomPct: roundZoomPercent(lastZoomPct) ?? 100,
        capturedAt: Date.now()
      })
    );
  } catch {
    // ignore
  }
}

function readViewportMetrics() {
  if (typeof window === 'undefined') return null;
  return {
    dpr: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    innerWidth: window.innerWidth,
    outerHeight: window.outerHeight,
    innerHeight: window.innerHeight
  };
}

function viewportMetricsChanged(baseline, metrics) {
  return (
    baseline.outerWidth !== metrics.outerWidth ||
    baseline.innerWidth !== metrics.innerWidth ||
    baseline.outerHeight !== metrics.outerHeight ||
    baseline.innerHeight !== metrics.innerHeight
  );
}

function isChromiumDesktop() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Chrome|Chromium|Edg\//.test(ua) && !/Mobile|Android/i.test(ua);
}

/** Pinch zoom on mobile (not window resize). */
function readPinchZoomPercent() {
  const scale = window.visualViewport?.scale;
  if (!Number.isFinite(scale) || scale <= 0 || scale === 1) return null;
  return roundZoomPercent(scale * 100);
}

/**
 * @param {ReturnType<typeof readStoredBaseline>} baseline
 * @param {ReturnType<typeof readViewportMetrics>} metrics
 * @returns {number | null}
 */
function estimatePageZoomFromBaseline(baseline, metrics) {
  if (!Number.isFinite(metrics.dpr) || metrics.dpr <= 0) return null;

  const lastZoom = roundZoomPercent(baseline.lastZoomPct) ?? 100;
  const pinchPct = readPinchZoomPercent();
  if (pinchPct != null) {
    writeStoredBaseline(
      metrics.dpr,
      metrics.outerWidth,
      metrics.innerWidth,
      metrics.outerHeight,
      metrics.innerHeight,
      pinchPct
    );
    return pinchPct;
  }

  if (viewportMetricsChanged(baseline, metrics)) {
    // Any window geometry change while DPR is stable = resize/layout, not Cmd+/Cmd-.
    writeStoredBaseline(
      metrics.dpr,
      metrics.outerWidth,
      metrics.innerWidth,
      metrics.outerHeight,
      metrics.innerHeight,
      100
    );
    return 100;
  }

  if (Math.abs(metrics.dpr - baseline.dpr) > 0.01) {
    const pct = roundZoomPercent((metrics.dpr / baseline.dpr) * lastZoom);
    writeStoredBaseline(
      metrics.dpr,
      metrics.outerWidth,
      metrics.innerWidth,
      metrics.outerHeight,
      metrics.innerHeight,
      pct ?? 100
    );
    return pct;
  }

  return lastZoom;
}

function ensureBaseline(metrics) {
  let baseline = readStoredBaseline();
  if (!baseline) {
    writeStoredBaseline(
      metrics.dpr,
      metrics.outerWidth,
      metrics.innerWidth,
      metrics.outerHeight,
      metrics.innerHeight,
      100
    );
    baseline = readStoredBaseline();
  }
  return baseline;
}

/** @returns {number | null} e.g. 75, 100, 125 — null when unknown */
export function estimateBrowserZoomPercent() {
  const metrics = readViewportMetrics();
  if (!metrics) return null;

  const baseline = ensureBaseline(metrics);
  if (!baseline) return null;

  return estimatePageZoomFromBaseline(baseline, metrics);
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
  if (Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) return true;
  const pinchScale = window.visualViewport?.scale;
  return Number.isFinite(pinchScale) && pinchScale > 0;
}
