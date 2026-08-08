/**
 * fe/.env — DISABLE_NAVIGATION_COLLAPSE=true keeps the left nav permanently expanded.
 * Requires vite envPrefix DISABLE_ (see vite.config.mjs).
 */

export function isNavigationCollapseDisabled() {
  return String(import.meta.env.DISABLE_NAVIGATION_COLLAPSE ?? '').trim().toLowerCase() === 'true';
}

/** Sidebar open state; forced true when collapse is disabled. */
export function navigationDrawerOpenState(isOpen) {
  if (isNavigationCollapseDisabled()) return true;
  return Boolean(isOpen);
}
