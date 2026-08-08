/** UsageBar registers a refresher; axios / bridge call it after Photo Albums Tx/Rx. */

let refreshUsage = null;
let refreshTimer = null;

export function registerPhotoAlbumsUsageRefresher(fn) {
  refreshUsage = typeof fn === 'function' ? fn : null;
  return () => {
    if (refreshUsage === fn) refreshUsage = null;
  };
}

/** Debounced refresh so bursts of API calls coalesce into one usage poll. */
export function requestPhotoAlbumsUsageRefresh({ delayMs = 400 } = {}) {
  if (typeof refreshUsage !== 'function') return;
  if (refreshTimer != null) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    try {
      refreshUsage();
    } catch {
      // ignore
    }
  }, Math.max(0, Number(delayMs) || 0));
}
