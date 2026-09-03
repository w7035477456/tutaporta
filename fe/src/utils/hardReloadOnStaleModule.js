const STORAGE_AT = 'omStaleModuleHardReloadAt';
const STORAGE_COUNT = 'omStaleModuleHardReloadCount';
const RELOAD_WINDOW_MS = 30000;
const MAX_RELOADS = 3;
const CACHE_BUST_PARAM = '_omr';
const INSTALL_FLAG = '__omStaleModuleHardReloadInstalled';

let reloadStarted = false;

function errorText(error) {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const cause = error.cause ? ` ${errorText(error.cause)}` : '';
    return `${error.name} ${error.message} ${error.stack || ''}${cause}`;
  }
  const extra = [error.message, error.error, error.statusText, error.data]
    .filter(Boolean)
    .map((part) => errorText(part))
    .join(' ');
  if (extra) return extra;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isFailedDynamicImportError(error) {
  const text = errorText(error);
  return (
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text) ||
    /Failed to load module script/i.test(text) ||
    /Loading chunk \d+ failed/i.test(text) ||
    /Unable to preload CSS/i.test(text)
  );
}

export function isAllowedStaleModuleReloadHost() {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'onlinemall.website' || host.endsWith('.onlinemall.website');
}

function readReloadState() {
  if (typeof sessionStorage === 'undefined') return { count: 0, last: 0 };
  try {
    const last = Number(sessionStorage.getItem(STORAGE_AT) || 0);
    const count = Number(sessionStorage.getItem(STORAGE_COUNT) || 0);
    if (!last || Date.now() - last > RELOAD_WINDOW_MS) return { count: 0, last: 0 };
    return { count: Number.isFinite(count) ? count : 0, last };
  } catch {
    return { count: 0, last: 0 };
  }
}

function markReloadStarted() {
  reloadStarted = true;
  if (typeof sessionStorage === 'undefined') return;
  try {
    const { count } = readReloadState();
    sessionStorage.setItem(STORAGE_AT, String(Date.now()));
    sessionStorage.setItem(STORAGE_COUNT, String(count + 1));
  } catch {
    /* ignore quota */
  }
}

/** Drop the guard after a successful lazy import so later Vite HMR can recover again. */
export function clearStaleModuleReloadGuard() {
  reloadStarted = false;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_AT);
    sessionStorage.removeItem(STORAGE_COUNT);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(CACHE_BUST_PARAM)) {
      url.searchParams.delete(CACHE_BUST_PARAM);
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', next);
    }
  } catch {
    /* ignore */
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Retry a lazy importer once — Vite often 404s the old chunk for a tick after HMR. */
export async function importWithStaleChunkRetry(importer) {
  try {
    return await importer();
  } catch (error) {
    if (!isFailedDynamicImportError(error)) throw error;
    await sleep(300);
    try {
      return await importer();
    } catch (retryError) {
      if (tryHardReloadOnFailedDynamicImport(retryError)) {
        return new Promise(() => {});
      }
      throw retryError;
    }
  }
}

/** Cache-busting navigation (more reliable than location.reload after Vite HMR). */
function hardReloadLikeShiftCmdR() {
  const url = new URL(window.location.href);
  url.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
}

/**
 * If this is a stale dynamic-import failure on localhost / onlinemall.website,
 * start one hard reload. Returns true when a reload was started (or is already in flight).
 * Returns false when the caller should show the error (reload already tried and failed).
 */
export function tryHardReloadOnFailedDynamicImport(error) {
  if (typeof window === 'undefined') return false;
  if (!isFailedDynamicImportError(error)) return false;
  if (!isAllowedStaleModuleReloadHost()) return false;
  if (reloadStarted) return true;
  const { count } = readReloadState();
  if (count >= MAX_RELOADS) return false;
  markReloadStarted();
  hardReloadLikeShiftCmdR();
  return true;
}

export function installHardReloadOnStaleModule() {
  if (typeof window === 'undefined') return;
  if (window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  window.addEventListener('error', (event) => {
    tryHardReloadOnFailedDynamicImport(event?.error || event?.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    tryHardReloadOnFailedDynamicImport(event?.reason);
  });
}
