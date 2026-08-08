/**
 * fe/.env — requires vite envPrefix GLOBAL_ (see vite.config.mjs).
 */

function envIsTrue(key) {
  const v = import.meta.env[key];
  return String(v ?? '').trim().toLowerCase() === 'true';
}

/** Red global ERROR dialog from console.error; enable only when explicitly true. */
export function isGlobalErrorPopupEnabled() {
  return envIsTrue('GLOBAL_ERROR_POPUP');
}
