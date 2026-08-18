const STORAGE_KEY = 'omStaleModuleHardReloadAt';
const RELOAD_COOLDOWN_MS = 20000;
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

function alreadyReloadedRecently() {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
    return Boolean(last) && Date.now() - last < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markReloadStarted() {
  reloadStarted = true;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore quota */
  }
}

/** Closest JS equivalent to Shift-Cmd-R: drop SW/cache, refetch the document bypassing HTTP cache, then reload. */
async function hardReloadLikeShiftCmdR() {
  const href = window.location.href;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if (window.caches?.keys) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }
  } catch {
    /* ignore */
  }
  try {
    await fetch(href, {
      cache: 'reload',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    });
  } catch {
    /* ignore — still reload */
  }
  window.location.reload();
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
  if (alreadyReloadedRecently()) return false;
  markReloadStarted();
  void hardReloadLikeShiftCmdR();
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
